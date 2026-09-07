import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).trim().regex(/^\S+$/, 'First name cannot contain spaces'),
  lastName: z.string().min(1, 'Last name is required').max(100).trim().regex(/^\S+$/, 'Last name cannot contain spaces'),
  email: z.string().email('Invalid email address').max(255).trim().toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  phone: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15)
    .regex(/^\+?[0-9]+$/, 'Invalid phone number format'),
  roleOfInterest: z.string().min(1, 'Role of interest is required').max(100).optional(),
  departmentOfInterest: z.string().min(1, 'Area of interest is required').max(100).optional(),
  dpdpConsent: z.preprocess(
    (val) => (val === true || val === 'true' || val === '1' || val === 1),
    z.literal(true, { errorMap: () => ({ message: "DPDP Consent is mandatory." }) })
  ),
  termsVersionId: z.string().max(50).optional().default('v1.0'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  purpose: z.enum(['EMAIL_VERIFICATION', 'PASSWORD_RESET']),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).trim().regex(/^\S+$/, 'First name cannot contain spaces').optional(),
  lastName: z.string().min(1).max(100).trim().regex(/^\S+$/, 'Last name cannot contain spaces').optional(),
  phone: z.string().min(10).max(15).regex(/^\+?[0-9]+$/).optional(),
});
