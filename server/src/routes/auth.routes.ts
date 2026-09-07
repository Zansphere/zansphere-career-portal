import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter';
import { registerSchema, loginSchema, verifyOtpSchema, forgotPasswordSchema, resetPasswordSchema } from '../utils/validators';
import { sendOtpEmail, generateOtp } from '../utils/email';
import { upload, s3Client } from './upload.routes';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import crypto from 'crypto';

const router = Router();

// ── POST /api/auth/register ──────────────────────────────────
router.post('/register', authLimiter, upload.single('resume'), async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => e.message);
      res.status(400).json({ error: errors[0], errors });
      return;
    }

    const { firstName, lastName, email, password, phone, roleOfInterest, departmentOfInterest } = parsed.data;

    if (!req.file) {
      res.status(400).json({ error: 'Resume (PDF) is required.' });
      return;
    }

    // Check if user already exists — return generic message to prevent enumeration
    const existing = await prisma.portalUser.findUnique({ where: { email } });
    if (existing) {
      if (existing.status === 'PENDING') {
        // Re-send OTP for unverified accounts (silently)
        const otp = generateOtp();
        const hashedOtp = await bcrypt.hash(otp, 10);
        
        await prisma.otp.updateMany({
          where: { userId: existing.id, purpose: 'EMAIL_VERIFICATION', used: false },
          data: { used: true },
        });

        await prisma.otp.create({
          data: {
            userId: existing.id,
            code: hashedOtp,
            purpose: 'EMAIL_VERIFICATION',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });

        sendOtpEmail(email, otp, 'verification').catch(console.error);
      }
      // Return same generic error for ALL existing accounts (PENDING, VERIFIED, SUSPENDED)
      res.status(400).json({ error: 'Invalid email or password.' });
      return;
    }

    // Upload resume to S3
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(req.file.originalname);
    const fileName = `resumes/resume-${uniqueSuffix}${ext}`;
    const bucketName = process.env.AWS_S3_BUCKET;

    if (!bucketName) {
      throw new Error('AWS_S3_BUCKET is not configured.');
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });
    await s3Client.send(command);
    const resumeUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user and profile draft in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.portalUser.create({
        data: {
          firstName,
          lastName,
          email,
          passwordHash,
          phone,
          status: 'PENDING',
        },
      });

      await tx.portalProfile.create({
        data: {
          userId: newUser.id,
          fullName: `${firstName} ${lastName}`,
          email,
          phone,
          dateOfBirth: new Date('2000-01-01'),
          city: '',
          state: '',
          employmentStatus: 'FRESHER',
          currentCompany: '',
          currentDesignation: '',
          totalExperienceYears: 0,
          totalExperienceMonths: 0,
          relevantExperienceYears: 0,
          relevantExperienceMonths: 0,
          noticePeriod: 'Immediate',
          preferredJobType: 'FULL_TIME',
          preferredWorkMode: 'ON_SITE',
          preferredDepartment: departmentOfInterest || '',
          roleOfInterest: roleOfInterest || '',
          resumeUrl,
          resumeFileName: req.file!.originalname,
          currentStep: 1,
          isComplete: false,
        },
      });

      return newUser;
    });

    // Generate and send OTP
    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await prisma.otp.create({
      data: {
        userId: user.id,
        code: hashedOtp,
        purpose: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    sendOtpEmail(email, otp, 'verification').catch(console.error);

    res.status(201).json({
      message: 'Registration successful! Please check your email for the verification OTP.',
      email: user.email,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/verify-otp ────────────────────────────────
router.post('/verify-otp', otpLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { email, otp, purpose } = parsed.data;

    const user = await prisma.portalUser.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ error: 'No account found with this email.' });
      return;
    }

    // Find latest unused OTP for this purpose
    const otpRecord = await prisma.otp.findFirst({
      where: {
        userId: user.id,
        purpose,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      res.status(400).json({ error: 'OTP has expired or is invalid. Please request a new one.' });
      return;
    }

    // Verify OTP
    const isValid = await bcrypt.compare(otp, otpRecord.code);
    if (!isValid) {
      res.status(400).json({ error: 'Invalid OTP. Please try again.' });
      return;
    }

    // Mark OTP as used
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    if (purpose === 'EMAIL_VERIFICATION') {
      // Activate account
      await prisma.portalUser.update({
        where: { id: user.id },
        data: { status: 'VERIFIED' },
      });

      // Restore old logic: Create a DRAFT candidate in Zanpeople immediately
      const profile = await prisma.portalProfile.findUnique({
        where: { userId: user.id },
      });

      if (profile && !profile.zanpeopleId) {
        const publicToken = crypto.randomBytes(16).toString('hex');
        const newCandidateId = crypto.randomUUID();
        
        await prisma.$executeRawUnsafe(`
          INSERT INTO candidates (id, public_token, name, email, phone, position_applied, status, created_at, updated_at)
          VALUES ($1::uuid, $2, $3, $4, $5, $6, 'DRAFT', NOW(), NOW())
        `, newCandidateId, publicToken, profile.fullName, profile.email, profile.phone, 'General Application');

        await prisma.portalProfile.update({
          where: { id: profile.id },
          data: { zanpeopleId: newCandidateId },
        });
      }

      const token = generateToken(user.id, user.email);
      res.json({
        message: 'Email verified successfully! You are now logged in.',
        token,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
        },
      });
    } else {
      // For password reset, return a temporary token
      res.json({
        message: 'OTP verified. You can now reset your password.',
        resetAllowed: true,
      });
    }
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { email, password } = parsed.data;

    const user = await prisma.portalUser.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      res.status(423).json({ error: `Account is temporarily locked. Try again in ${mins} minutes.` });
      return;
    }

    // Check if email is verified
    if (user.status === 'PENDING') {
      res.status(403).json({ error: 'Please verify your email before logging in.', requiresVerification: true });
      return;
    }

    if (user.status === 'SUSPENDED') {
      res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      // Increment failed attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      const updateData: any = { failedLoginAttempts: failedAttempts };

      // Lock account after 5 failed attempts (30 min lockout)
      if (failedAttempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        updateData.failedLoginAttempts = 0;
      }

      await prisma.portalUser.update({
        where: { id: user.id },
        data: updateData,
      });

      if (failedAttempts >= 5) {
        res.status(423).json({ error: 'Too many failed attempts. Account locked for 30 minutes.' });
      } else {
        res.status(401).json({ error: 'Invalid email or password.' });
      }
      return;
    }

    // Reset failed attempts on successful login
    await prisma.portalUser.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const token = generateToken(user.id, user.email);
    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────
router.post('/forgot-password', otpLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { email } = parsed.data;

    const user = await prisma.portalUser.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      res.json({ message: 'If an account exists with this email, an OTP has been sent.' });
      return;
    }

    // Invalidate old reset OTPs
    await prisma.otp.updateMany({
      where: { userId: user.id, purpose: 'PASSWORD_RESET', used: false },
      data: { used: true },
    });

    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await prisma.otp.create({
      data: {
        userId: user.id,
        code: hashedOtp,
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    sendOtpEmail(email, otp, 'reset').catch(console.error);

    res.json({ message: 'If an account exists with this email, an OTP has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────
router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => e.message);
      res.status(400).json({ error: errors[0], errors });
      return;
    }

    const { email, otp, newPassword } = parsed.data;

    const user = await prisma.portalUser.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ error: 'No account found.' });
      return;
    }

    // Verify OTP
    const otpRecord = await prisma.otp.findFirst({
      where: {
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      res.status(400).json({ error: 'OTP has expired or is invalid. Please request a new one.' });
      return;
    }

    const isValid = await bcrypt.compare(otp, otpRecord.code);
    if (!isValid) {
      res.status(400).json({ error: 'Invalid OTP.' });
      return;
    }

    // Mark OTP as used & update password
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.portalUser.update({
      where: { id: user.id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    res.json({ message: 'Password reset successfully! You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

// ── POST /api/auth/resend-otp ────────────────────────────────
router.post('/resend-otp', otpLimiter, async (req: Request, res: Response) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !purpose) {
      res.status(400).json({ error: 'Email and purpose are required.' });
      return;
    }

    const user = await prisma.portalUser.findUnique({ where: { email } });
    if (!user) {
      res.json({ message: 'If an account exists, a new OTP has been sent.' });
      return;
    }

    // Invalidate old OTPs
    await prisma.otp.updateMany({
      where: { userId: user.id, purpose, used: false },
      data: { used: true },
    });

    const otp = generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await prisma.otp.create({
      data: {
        userId: user.id,
        code: hashedOtp,
        purpose,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const emailPurpose = purpose === 'EMAIL_VERIFICATION' ? 'verification' : 'reset';
    sendOtpEmail(email, otp, emailPurpose).catch(console.error);

    res.json({ message: 'A new OTP has been sent to your email.' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: 'Failed to resend OTP. Please try again.' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.portalUser.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to fetch user data.' });
  }
});

export default router;
