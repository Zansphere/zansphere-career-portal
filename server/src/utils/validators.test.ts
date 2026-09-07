import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema
} from './validators';

describe('Validators', () => {
  describe('registerSchema', () => {
    it('should pass with valid data', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        phone: '1234567890',
        roleOfInterest: 'Developer',
        departmentOfInterest: 'Engineering',
        dpdpConsent: true,
      };
      expect(registerSchema.safeParse(validData).success).toBe(true);
    });

    it('should fail with missing fields', () => {
      expect(registerSchema.safeParse({}).success).toBe(false);
    });

    it('should fail with invalid email', () => {
      const invalidEmail = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        password: 'Password123!',
        phone: '1234567890'
      };
      expect(registerSchema.safeParse(invalidEmail).success).toBe(false);
    });

    it('should fail with weak password', () => {
      const weakPassword = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'weak',
        phone: '1234567890'
      };
      expect(registerSchema.safeParse(weakPassword).success).toBe(false);
    });
    
    it('should pass and trim when names have trailing/leading spaces', () => {
      const data = {
        firstName: 'John ',
        lastName: ' Doe ',
        email: 'john.doe@example.com',
        password: 'Password123!',
        phone: '1234567890'
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.firstName).toBe('John');
        expect(result.data.lastName).toBe('Doe');
      }
    });
  });

  describe('loginSchema', () => {
    it('should pass with valid data', () => {
      expect(loginSchema.safeParse({ email: 'test@test.com', password: 'Password123!' }).success).toBe(true);
    });

    it('should fail with invalid email', () => {
      expect(loginSchema.safeParse({ email: 'test', password: 'Password123!' }).success).toBe(false);
    });
  });

  describe('verifyOtpSchema', () => {
    it('should pass with valid data', () => {
      expect(verifyOtpSchema.safeParse({ email: 'test@test.com', otp: '123456', purpose: 'EMAIL_VERIFICATION' }).success).toBe(true);
      expect(verifyOtpSchema.safeParse({ email: 'test@test.com', otp: '123456', purpose: 'PASSWORD_RESET' }).success).toBe(true);
    });

    it('should fail with invalid otp length', () => {
      expect(verifyOtpSchema.safeParse({ email: 'test@test.com', otp: '12345', purpose: 'EMAIL_VERIFICATION' }).success).toBe(false);
    });

    it('should fail with invalid purpose', () => {
      expect(verifyOtpSchema.safeParse({ email: 'test@test.com', otp: '123456', purpose: 'INVALID' }).success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should pass with valid email', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'test@test.com' }).success).toBe(true);
    });
    it('should fail with invalid email', () => {
      expect(forgotPasswordSchema.safeParse({ email: 'test' }).success).toBe(false);
    });
  });

  describe('resetPasswordSchema', () => {
    it('should pass with valid data', () => {
      expect(resetPasswordSchema.safeParse({ email: 'test@test.com', otp: '123456', newPassword: 'Password123!' }).success).toBe(true);
    });
    it('should fail with weak new password', () => {
      expect(resetPasswordSchema.safeParse({ email: 'test@test.com', otp: '123456', newPassword: 'weak' }).success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should pass with valid data', () => {
      expect(changePasswordSchema.safeParse({ currentPassword: 'OldPassword123!', newPassword: 'NewPassword123!' }).success).toBe(true);
    });
    it('should fail without current password', () => {
      expect(changePasswordSchema.safeParse({ newPassword: 'NewPassword123!' }).success).toBe(false);
    });
  });

  describe('updateProfileSchema', () => {
    it('should pass with valid partial data', () => {
      expect(updateProfileSchema.safeParse({ firstName: 'Jane' }).success).toBe(true);
      expect(updateProfileSchema.safeParse({ lastName: 'Smith', phone: '0987654321' }).success).toBe(true);
      expect(updateProfileSchema.safeParse({}).success).toBe(true);
    });
    it('should pass and trim spaces in names', () => {
      const result = updateProfileSchema.safeParse({ firstName: ' Jane ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.firstName).toBe('Jane');
      }
    });
    it('should fail with invalid phone', () => {
      expect(updateProfileSchema.safeParse({ phone: 'abc' }).success).toBe(false);
    });
  });
});
