import { z } from 'zod';

export const submitPaymentSchema = z.object({
  paymentReference: z
    .string()
    .trim()
    .min(3, 'Payment reference (UTR or UPI Ref) must be at least 3 characters')
    .max(100, 'Payment reference cannot exceed 100 characters'),
});

export const reviewPaymentSchema = z.object({
  status: z.enum(['CONFIRMED', 'REJECTED'], {
    errorMap: () => ({ message: 'Status must be either CONFIRMED or REJECTED' }),
  }),
  reviewNote: z.string().trim().max(200).optional(),
});
