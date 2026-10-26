import { z } from 'zod';

export const createPoolSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title cannot exceed 100 characters'),
  retailer: z.enum(['Blinkit', 'Zepto', 'Flipkart Minutes', 'Other'], {
    errorMap: () => ({ message: 'Retailer must be Blinkit, Zepto, Flipkart Minutes, or Other' }),
  }),
  retailerCustomName: z.string().trim().max(50).optional(),
  hostel: z.enum(['Uniworld 1', 'Uniworld 2'], {
    errorMap: () => ({ message: 'Hostel must be Uniworld 1 or Uniworld 2' }),
  }),
  deliveryZone: z
    .string()
    .trim()
    .min(2, 'Delivery zone/pickup spot must be at least 2 characters')
    .max(100, 'Delivery zone cannot exceed 100 characters'),
  targetAmount: z
    .number({ invalid_type_error: 'Target amount must be a number' })
    .min(1, 'Target amount must be at least ₹1')
    .max(50000, 'Target amount cannot exceed ₹50,000'),
  contributionCap: z
    .number()
    .min(1, 'Contribution cap must be at least ₹1')
    .max(50000)
    .optional(),
  participantLimit: z
    .number()
    .int('Participant limit must be an integer')
    .min(2, 'At least 2 participants required')
    .max(30, 'Participant limit cannot exceed 30')
    .default(8),
  closingTime: z.string().refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime()) && d.getTime() > Date.now();
  }, 'Closing time must be a valid future date and time'),
  notes: z.string().trim().max(300).optional(),
});

export const orderPlacedSchema = z.object({
  finalPayableAmount: z
    .number({ invalid_type_error: 'Final payable amount must be a number' })
    .min(1, 'Final payable amount must be at least ₹1'),
  actualRetailerMinimum: z.number().min(0).optional(),
  deliveryFee: z.number().min(0).default(0),
  otherCharges: z.number().min(0).default(0),
  paymentInstructions: z.string().trim().max(300).optional(),
  upiId: z.string().trim().max(60).optional(),
  qrCodeUrl: z.string().trim().optional(),
});
