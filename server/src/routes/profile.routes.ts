import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { updateProfileSchema, changePasswordSchema } from '../utils/validators';

const router = Router();
router.use(authMiddleware);

// ── URL validation helper ────────────────────────────────────
function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateUrlFields(data: Record<string, any>): string | null {
  const urlFields = ['linkedinUrl', 'githubUrl', 'portfolioUrl', 'resumeUrl'];
  for (const field of urlFields) {
    const value = data[field];
    if (value && typeof value === 'string' && value.trim() !== '') {
      if (!isValidUrl(value)) {
        return `Invalid URL for ${field}. Only http:// and https:// URLs are allowed.`;
      }
    }
  }
  return null;
}

// ── GET /api/profile ─────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.portalProfile.findUnique({
      where: { userId: req.userId },
      include: { 
        employmentHistory: true,
        educationHistory: true 
      },
    });

    if (!profile) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    res.json({ profile });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// ── PUT /api/profile ─ Update basic profile settings ───────
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const fullName = `${firstName} ${lastName}`.trim();

    const profile = await prisma.portalProfile.findUnique({
      where: { userId: req.userId },
    });

    if (!profile) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    const [updatedProfile, updatedUser] = await prisma.$transaction(async (tx) => {
      const p = await tx.portalProfile.update({
        where: { id: profile.id },
        data: { fullName, phone },
      });

      const u = await tx.portalUser.update({
        where: { id: req.userId },
        data: { firstName, lastName, phone },
      });

      if (p.zanpeopleId) {
        await tx.$executeRawUnsafe(`
          UPDATE candidates 
          SET name = $1, phone = $2, updated_at = NOW()
          WHERE id = $3::uuid
        `, fullName, phone, p.zanpeopleId);
      }
      return [p, u];
    });

    const userPayload = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phone: updatedUser.phone,
    };

    res.json({ message: 'Profile updated successfully!', user: userPayload });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ── PUT /api/profile/step/:step ─ Save a step ───────
router.put('/step/:step', async (req: AuthRequest, res: Response) => {
  try {
    const { step } = req.params;
    const stepNum = parseInt(step);

    const profile = await prisma.portalProfile.findUnique({
      where: { userId: req.userId },
      include: { educationHistory: true },
    });

    if (!profile) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    const data: any = { ...req.body };

    // Prevent bypass
    delete data.isComplete;
    delete data.currentStep;

    // Sanitize string fields against CSV injection and enforce max lengths
    for (const key of Object.keys(data)) {
      if (typeof data[key] === 'string') {
        data[key] = data[key].replace(/^[=+\-@]+/, '');
        if ((key === 'firstName' || key === 'lastName' || key === 'fullName') && data[key].length > 200) {
          res.status(400).json({ error: `${key} cannot exceed 200 characters.` });
          return;
        }
      }
    }

    // Skills max limit: max 7 skills per category
    if (data.skills && Array.isArray(data.skills)) {
      for (const entry of data.skills) {
        if (entry && typeof entry.skills === 'string') {
          const count = entry.skills.split(',').map((s: string) => s.trim()).filter(Boolean).length;
          if (count > 7) {
            res.status(400).json({ 
              error: `Maximum 7 skills allowed for ${entry.category || 'each category'}. Found ${count} skills.` 
            });
            return;
          }
        }
      }
    }

    // Validate URL fields before saving
    const urlError = validateUrlFields(data);
    if (urlError) {
      res.status(400).json({ error: urlError });
      return;
    }

    // Validate preferredDepartment against active departments in DB (Bug 09)
    if (data.preferredDepartment !== undefined) {
      if (!data.preferredDepartment || typeof data.preferredDepartment !== 'string' || !data.preferredDepartment.trim()) {
        if (stepNum === 5) {
          res.status(400).json({ error: 'Preferred department is required.' });
          return;
        }
      } else {
        const activeDepts = await prisma.$queryRawUnsafe<any[]>(`
          SELECT name FROM departments WHERE is_active = true
        `);
        const validNames = activeDepts.map(d => d.name.toLowerCase().trim());
        const inputDept = data.preferredDepartment.toLowerCase().trim();
        const isValid = validNames.some(name => 
          name === inputDept || 
          (inputDept.length >= 3 && (name.includes(inputDept) || inputDept.includes(name)))
        );

        if (!isValid) {
          res.status(400).json({ 
            error: 'Invalid department selected. Please select a valid department from the available options.' 
          });
          return;
        }
      }
    }
    
    // Handle employment history separately (Step 2)
    if (stepNum === 2 && data.employmentHistory) {
      const historyEntries = data.employmentHistory;
      delete data.employmentHistory;

      await prisma.employmentHistoryEntry.deleteMany({
        where: { profileId: profile.id },
      });

      if (historyEntries.length > 0) {
        await prisma.employmentHistoryEntry.createMany({
          data: historyEntries.map((entry: any) => ({
            profileId: profile.id,
            company: entry.company,
            role: entry.role,
            durationFrom: entry.durationFrom,
            durationTo: entry.durationTo,
          })),
        });
      }
    }

    // Handle education history separately (Step 3)
    if (stepNum === 3 && data.educationHistory) {
      const historyEntries = data.educationHistory;
      delete data.educationHistory;

      await prisma.portalEducationHistory.deleteMany({
        where: { profileId: profile.id },
      });

      const maxGradYear = Math.max(2026, new Date().getFullYear());
      const currentYear = new Date().getFullYear();
      for (const entry of historyEntries) {
        const year = parseInt(entry.yearOfPassing);
        if (year < 2000 || year > maxGradYear) {
          res.status(400).json({ error: `Graduation year must be between 2000 and ${maxGradYear}.` });
          return;
        }

        // Temporal cross-validation with Experience (Bug 18)
        if (profile.employmentStatus !== 'FRESHER' && profile.totalExperienceYears && profile.totalExperienceYears > 0) {
          const maxPossibleExp = Math.max(0, (currentYear - year) + 1);
          if (profile.totalExperienceYears > maxPossibleExp) {
            res.status(400).json({ 
              error: `Graduation year (${year}) is inconsistent with your recorded ${profile.totalExperienceYears} years of work experience. Maximum possible experience is ${maxPossibleExp} years.` 
            });
            return;
          }
        }
      }

      if (historyEntries.length > 0) {
        await prisma.portalEducationHistory.createMany({
          data: historyEntries.map((entry: any) => ({
            profileId: profile.id,
            institution: entry.institution,
            degreeSpecialization: entry.degreeSpecialization,
            yearOfPassing: parseInt(entry.yearOfPassing) || new Date().getFullYear(),
            percentageOrCgpa: entry.percentageOrCgpa,
          })),
        });
      }
    }

    // Clean up non-model fields
    delete data.id;
    delete data.userId;
    delete data.createdAt;
    delete data.updatedAt;

    // Handle date field
    if (data.dateOfBirth) {
      data.dateOfBirth = new Date(data.dateOfBirth);
    }

    // Handle numeric fields & Freshers logic
    if (data.employmentStatus === 'FRESHER') {
      data.totalExperienceYears = 0;
      data.totalExperienceMonths = 0;
      data.relevantExperienceYears = 0;
      data.relevantExperienceMonths = 0;
      data.currentCompany = 'N/A';
      data.currentDesignation = 'N/A';
      data.currentCtcFixed = null;
      data.currentCtcVariable = null;
    } else {
      if (data.totalExperienceYears !== undefined) {
        data.totalExperienceYears = parseInt(data.totalExperienceYears) || 0;
        if (data.totalExperienceYears < 0 || data.totalExperienceYears > 30) {
          res.status(400).json({ error: 'Experience must be between 0 and 30 years.' });
          return;
        }

        // Temporal cross-validation with Education (Bug 18)
        if (profile.educationHistory && profile.educationHistory.length > 0 && data.totalExperienceYears > 0) {
          const currentYear = new Date().getFullYear();
          const gradYears = profile.educationHistory.map((e: any) => e.yearOfPassing);
          const maxGradYear = Math.max(...gradYears);
          const maxPossibleExp = Math.max(0, (currentYear - maxGradYear) + 1);
          if (data.totalExperienceYears > maxPossibleExp) {
            res.status(400).json({ 
              error: `Work experience (${data.totalExperienceYears} years) is inconsistent with your graduation year (${maxGradYear}). Maximum possible experience is ${maxPossibleExp} years.` 
            });
            return;
          }
        }
      }
      if (data.totalExperienceMonths !== undefined) data.totalExperienceMonths = parseInt(data.totalExperienceMonths) || 0;
      if (data.relevantExperienceYears !== undefined) data.relevantExperienceYears = parseInt(data.relevantExperienceYears) || 0;
      if (data.relevantExperienceMonths !== undefined) data.relevantExperienceMonths = parseInt(data.relevantExperienceMonths) || 0;
    }

    // Handle decimal fields
    const validateCtc = (rawVal: any, name: string, allowZero = false) => {
      const strVal = String(rawVal).trim();
      if (strVal.length > 7) return `${name} cannot exceed 7 characters.`;
      const val = parseFloat(strVal);
      if (allowZero && (val === 0 || strVal === '0')) return null;
      if (isNaN(val) || val < 100000 || val > 9999999) return `${name} must be between 100,000 and 9,999,999.`;
      return null;
    };

    if (data.currentCtcFixed !== undefined) {
      if (data.currentCtcFixed !== null && data.currentCtcFixed !== '') {
        const err = validateCtc(data.currentCtcFixed, 'Current CTC');
        if (err) { res.status(400).json({ error: err }); return; }
        data.currentCtcFixed = parseFloat(data.currentCtcFixed);
      } else data.currentCtcFixed = null;
    }
    
    if (data.currentCtcVariable !== undefined) {
      if (data.currentCtcVariable !== null && data.currentCtcVariable !== '') {
        const err = validateCtc(data.currentCtcVariable, 'Variable CTC', true);
        if (err) { res.status(400).json({ error: err }); return; }
        data.currentCtcVariable = parseFloat(data.currentCtcVariable);
      } else data.currentCtcVariable = null;
    }

    if (data.expectedCtc !== undefined) {
      if (data.expectedCtc !== null && data.expectedCtc !== '') {
        const err = validateCtc(data.expectedCtc, 'Expected CTC');
        if (err) { res.status(400).json({ error: err }); return; }
        data.expectedCtc = parseFloat(data.expectedCtc);
      } else data.expectedCtc = null;
    }

    // Update current step (only advance, don't go back)
    if (stepNum >= (profile.currentStep || 1)) {
      data.currentStep = stepNum + 1;
    }

    // Check if profile is complete (e.g. they reached step 7 and clicked submit)
    if (stepNum === 7 && data.dpdpConsent) {
      data.isComplete = true;
      data.consentTimestamp = new Date();
      data.consentIp = req.ip || '';
      data.termsVersionId = data.termsVersionId || 'v1.0';
    }

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.portalProfile.update({
        where: { id: profile.id },
        data,
        include: { employmentHistory: true, educationHistory: true },
      });

      if (stepNum === 1) {
        // Sync back to PortalUser
        const parts = (p.fullName || '').trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';

        await tx.portalUser.update({
          where: { id: req.userId },
          data: { firstName, lastName, phone: p.phone },
        });
      }

      // Sync to Zanpeople candidate if it exists
      if (p.zanpeopleId) {
        const yearsExp = (p.totalExperienceYears || 0) + ((p.totalExperienceMonths || 0) / 12);
        
        await tx.$executeRawUnsafe(`
          UPDATE candidates 
          SET 
            name = $1,
            phone = $2,
            city = $3,
            state = $4,
            years_experience = $5,
            current_company = $6,
            notice_period = $7,
            current_salary = $8,
            expected_salary = $9,
            linkedin_url = $10,
            github_url = $11,
            portfolio_url = $12,
            updated_at = NOW()
          WHERE id = $13::uuid
        `, 
          p.fullName,
          p.phone,
          p.city || null,
          p.state || null,
          yearsExp || null,
          p.currentCompany || null,
          p.noticePeriod || null,
          p.currentCtcFixed || null,
          p.expectedCtc || null,
          p.linkedinUrl || null,
          p.githubUrl || null,
          p.portfolioUrl || null,
          p.zanpeopleId
        );
      }
      return p;
    });

    res.json({ message: 'Step saved successfully!', profile: updated });
  } catch (err) {
    console.error('Save step error:', err);
    res.status(500).json({ error: 'Failed to save step data.' });
  }
});

// ── POST /api/profile/change-password ────────────────────────
router.post('/change-password', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => e.message);
      res.status(400).json({ error: errors[0], errors });
      return;
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.portalUser.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.portalUser.update({
      where: { id: req.userId },
      data: { passwordHash },
    });

    res.json({ message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// ── DELETE /api/profile ─ Delete candidate profile (DPDP Erasure) ───────
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const profile = await prisma.portalProfile.findUnique({
      where: { userId: req.userId },
    });

    if (!profile) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    // Attempt to delete candidate from Zanpeople ATS if it exists
    if (profile.zanpeopleId) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM candidates WHERE id = $1::uuid`, profile.zanpeopleId);
      } catch (err) {
        console.error('Failed to delete from Zanpeople:', err);
      }
    }

    // Delete PortalUser (Cascades to PortalProfile, OTPs, etc)
    await prisma.portalUser.delete({
      where: { id: req.userId },
    });

    res.json({ message: 'Your account and profile data have been permanently deleted.' });
  } catch (err) {
    console.error('Delete profile error:', err);
    res.status(500).json({ error: 'Failed to delete account data.' });
  }
});

export default router;
