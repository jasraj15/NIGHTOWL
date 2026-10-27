import { z } from 'zod';

export const COLLEGE_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@sst\.scaler\.com$/;

const collegeEmail = z
  .string()
  .trim()
  .toLowerCase()
  .regex(COLLEGE_EMAIL_REGEX, 'Email must be a valid @sst.scaler.com address');

const indianPhone = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9)');

const hostelEnum = z.enum(['Uniworld 1', 'Uniworld 2'], {
  errorMap: () => ({ message: 'Hostel must be either Uniworld 1 or Uniworld 2' }),
});

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(60, 'Full name cannot exceed 60 characters'),
  email: collegeEmail,
  phoneNumber: indianPhone,
  /** Hostel is chosen on the dedicated screen after verification; accepted here only for compatibility. */
  hostel: hostelEnum.optional(),
  roomNumber: z.string().trim().max(20).optional(),
  agreedToRules: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the community rules and privacy policy' }),
  }),
});

export const verifyOtpSchema = z.object({
  email: collegeEmail,
  otp: z.string().trim().regex(/^\d{6}$/, 'Verification code must be exactly 6 digits'),
  purpose: z.enum(['register', 'login']),
});

export const requestLoginOtpSchema = z.object({ email: collegeEmail });

export const resendOtpSchema = z.object({
  email: collegeEmail,
  purpose: z.enum(['register', 'login']),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(60).optional(),
  phoneNumber: indianPhone.optional(),
  hostel: hostelEnum.optional(),
  roomNumber: z.string().trim().max(20).optional(),
});

export const selectHostelSchema = z.object({
  hostel: hostelEnum,
});

export const updatePreferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  showPhoneToPoolMembers: z.boolean().optional(),
  notifications: z
    .object({
      poolInvitations: z.boolean().optional(),
      someoneJoinsMyPool: z.boolean().optional(),
      poolNearlyFull: z.boolean().optional(),
      deadlineApproaching: z.boolean().optional(),
      paymentUpdates: z.boolean().optional(),
      orderUpdates: z.boolean().optional(),
    })
    .optional(),
});

export const deactivateAccountSchema = z.object({
  confirmEmail: collegeEmail,
});
