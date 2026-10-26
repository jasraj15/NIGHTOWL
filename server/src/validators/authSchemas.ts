import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(60, 'Full name cannot exceed 60 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-zA-Z0-9._%+-]+@sst\.scaler\.com$/, 'Email must be a valid @sst.scaler.com address'),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number (starting with 6, 7, 8, or 9)'),
  hostel: z.enum(['Uniworld 1', 'Uniworld 2'], {
    errorMap: () => ({ message: 'Hostel must be either Uniworld 1 or Uniworld 2' }),
  }),
  roomNumber: z.string().trim().max(20).optional(),
});

export const verifyOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-zA-Z0-9._%+-]+@sst\.scaler\.com$/, 'Valid @sst.scaler.com email required'),
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Verification code must be exactly 6 digits'),
  purpose: z.enum(['register', 'login']),
});

export const requestLoginOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-zA-Z0-9._%+-]+@sst\.scaler\.com$/, 'Valid @sst.scaler.com email required'),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(60).optional(),
  phoneNumber: z.string().trim().regex(/^[6-9]\d{9}$/).optional(),
  hostel: z.enum(['Uniworld 1', 'Uniworld 2']).optional(),
  roomNumber: z.string().trim().max(20).optional(),
});
