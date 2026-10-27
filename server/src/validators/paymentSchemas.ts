import { z } from 'zod';

export const submitPaymentSchema = z.object({
  paymentReference: z
    .string()
    .trim()
    .min(3, 'Payment reference (UTR or UPI Ref) must be at least 3 characters')
    .max(100, 'Payment reference cannot exceed 100 characters'),
});

export const reviewPaymentSchema = z.object({
  status: z.enum(['PAID', 'FAILED'], {
    errorMap: () => ({ message: 'Status must be either PAID or FAILED' }),
  }),
  reviewNote: z.string().trim().max(200).optional(),
});

export const verifyRazorpayPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().regex(/^order_[A-Za-z0-9]+$/, 'Invalid order id'),
  razorpay_payment_id: z.string().trim().regex(/^pay_[A-Za-z0-9]+$/, 'Invalid payment id'),
  razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i, 'Invalid signature format'),
});
