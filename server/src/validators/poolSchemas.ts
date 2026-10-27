import { z } from 'zod';
import { env } from '../config/env.js';

export const COUNTDOWN_PRESETS_MINUTES = [5, 10, 15, 20, 30, 45, 60] as const;

const hostelEnum = z.enum(['Uniworld 1', 'Uniworld 2'], {
  errorMap: () => ({ message: 'Hostel must be Uniworld 1 or Uniworld 2' }),
});

export const createPoolSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100, 'Title cannot exceed 100 characters'),
    retailer: z.enum(['Blinkit', 'Zepto', 'Flipkart Minutes', 'Other'], {
      errorMap: () => ({ message: 'Retailer must be Blinkit, Zepto, Flipkart Minutes, or Other' }),
    }),
    retailerCustomName: z.string().trim().max(50).optional(),
    hostel: hostelEnum,
    deliveryZone: z
      .string()
      .trim()
      .min(2, 'Delivery location must be at least 2 characters')
      .max(100, 'Delivery location cannot exceed 100 characters'),
    /** Creator must explicitly confirm the delivery location/eligibility for this hostel. */
    deliveryConfirmed: z.literal(true, {
      errorMap: () => ({ message: 'Please confirm the delivery location and hostel eligibility' }),
    }),
    targetAmount: z
      .number({ invalid_type_error: 'Minimum order value must be a number' })
      .min(1, 'Minimum order value must be at least ₹1')
      .max(50000, 'Minimum order value cannot exceed ₹50,000'),
    contributionCap: z.number().min(1, 'Per-person cap must be at least ₹1').max(50000).optional(),
    participantLimit: z
      .number()
      .int('Participant limit must be an integer')
      .min(2, 'At least 2 participants required')
      .max(30, 'Participant limit cannot exceed 30')
      .default(8),
    /**
     * Countdown in minutes from the SERVER's clock (never a client-supplied absolute time).
     * Presets: 5/10/15/20/30/45/60; anything else is treated as a custom duration within limits.
     */
    durationMinutes: z
      .number({ invalid_type_error: 'Duration must be a number of minutes' })
      .int()
      .min(env.POOL_MIN_DURATION_MINUTES, `Duration must be at least ${env.POOL_MIN_DURATION_MINUTES} minutes`)
      .max(env.POOL_MAX_DURATION_MINUTES, `Duration cannot exceed ${env.POOL_MAX_DURATION_MINUTES} minutes`)
      .optional(),
    /** Legacy field: accepted for backwards compatibility and converted to a duration server-side. */
    closingTime: z.string().optional(),
    notes: z.string().trim().max(300).optional(),
    expectedDeliveryFee: z.number().min(0).max(5000).optional(),
    feeNotes: z.string().trim().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.retailer === 'Other' && !data.retailerCustomName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['retailerCustomName'], message: 'Please name the retailer' });
    }
    if (data.durationMinutes === undefined && !data.closingTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['durationMinutes'], message: 'Choose how long the pool stays open' });
    }
    if (data.closingTime !== undefined && data.durationMinutes === undefined) {
      const d = new Date(data.closingTime);
      const minutes = Math.round((d.getTime() - Date.now()) / 60000);
      if (isNaN(d.getTime()) || minutes < env.POOL_MIN_DURATION_MINUTES || minutes > env.POOL_MAX_DURATION_MINUTES) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['closingTime'],
          message: `Closing time must be between ${env.POOL_MIN_DURATION_MINUTES} and ${env.POOL_MAX_DURATION_MINUTES} minutes from now`,
        });
      }
    }
  });

export type CreatePoolInput = z.infer<typeof createPoolSchema>;

/** Resolve the effective duration in minutes (server clock is authoritative). */
export function resolveDurationMinutes(data: CreatePoolInput): number {
  if (data.durationMinutes !== undefined) return data.durationMinutes;
  const d = new Date(data.closingTime!);
  return Math.max(env.POOL_MIN_DURATION_MINUTES, Math.round((d.getTime() - Date.now()) / 60000));
}

export const joinPoolSchema = z.object({
  deliveryConfirmed: z.literal(true, {
    errorMap: () => ({ message: 'Please confirm you can collect from this pool’s delivery location' }),
  }),
});

export const extendPoolSchema = z.object({
  additionalMinutes: z
    .number({ invalid_type_error: 'Minutes must be a number' })
    .int()
    .min(5, 'Extend by at least 5 minutes')
    .max(env.POOL_MAX_DURATION_MINUTES, `Cannot extend by more than ${env.POOL_MAX_DURATION_MINUTES} minutes`),
});

export const lockPoolSchema = z.object({
  /** Required when currentSubtotal < targetAmount: owner confirms the retailer's real requirement. */
  proceedBelowTargetConfirmed: z.boolean().optional(),
});

export const orderPlacedSchema = z.object({
  finalPayableAmount: z
    .number({ invalid_type_error: 'Final payable amount must be a number' })
    .min(1, 'Final payable amount must be at least ₹1')
    .max(100000),
  actualRetailerMinimum: z.number().min(0).max(100000).optional(),
  deliveryFee: z.number().min(0).max(5000).default(0),
  otherCharges: z.number().min(0).max(5000).default(0),
  paymentInstructions: z.string().trim().max(300).optional(),
  upiId: z
    .string()
    .trim()
    .max(60)
    .regex(/^[\w.\-]{2,}@[a-zA-Z]{2,}$/, 'Enter a valid UPI ID like name@bank')
    .optional()
    .or(z.literal('')),
  qrCodeUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  retailerOrderReference: z.string().trim().max(60).optional(),
});

export const reportSchema = z.object({
  reason: z.enum(['INAPPROPRIATE_CONTENT', 'SUSPICIOUS_PAYMENT', 'ABUSIVE_PARTICIPANT', 'OTHER']),
  details: z.string().trim().min(5, 'Please describe the issue').max(500),
  reportedUserId: z.string().trim().optional(),
});

export const discoverPoolsQuerySchema = z.object({
  hostel: z.enum(['Uniworld 1', 'Uniworld 2', 'ALL']).optional(),
  retailer: z.enum(['Blinkit', 'Zepto', 'Flipkart Minutes', 'Other', 'ALL']).optional(),
  status: z.enum(['OPEN', 'LOCKED', 'ORDERED', 'DELIVERED', 'CANCELLED', 'EXPIRED', 'ALL']).optional(),
  search: z.string().trim().max(80).optional(),
  closingSoon: z.enum(['true', 'false']).optional(),
  maxRemaining: z.coerce.number().min(0).optional(),
  minParticipants: z.coerce.number().int().min(0).optional(),
  maxParticipants: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['closing', 'newest', 'remaining', 'participants']).default('closing'),
});
