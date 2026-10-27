import { Router } from 'express';
import {
  getPaymentConfig,
  getMyContribution,
  createPaymentOrder,
  verifyPaymentCheckout,
  submitPaymentReference,
  reviewPayment,
  getMyPaymentHistory,
} from '../controllers/paymentController.js';
import { requireAuth, requireVerifiedCollegeEmail } from '../middlewares/auth.js';
import { paymentActionLimiter } from '../middlewares/rateLimiter.js';

/** Routes mounted under /pools/:poolId/payments */
export const poolPaymentRoutes = Router();

poolPaymentRoutes.get('/:poolId/payments/me', requireAuth, requireVerifiedCollegeEmail, getMyContribution);
poolPaymentRoutes.post('/:poolId/payments/razorpay/order', requireAuth, requireVerifiedCollegeEmail, paymentActionLimiter, createPaymentOrder);
poolPaymentRoutes.post('/:poolId/payments/razorpay/verify', requireAuth, requireVerifiedCollegeEmail, paymentActionLimiter, verifyPaymentCheckout);
poolPaymentRoutes.post('/:poolId/payments/manual', requireAuth, requireVerifiedCollegeEmail, paymentActionLimiter, submitPaymentReference);
poolPaymentRoutes.post('/:poolId/payments/:paymentId/review', requireAuth, requireVerifiedCollegeEmail, reviewPayment);

/** Routes mounted under /payments (webhook is mounted separately with a raw body parser). */
export const paymentRoutes = Router();
paymentRoutes.get('/config', getPaymentConfig);
paymentRoutes.get('/history', requireAuth, getMyPaymentHistory);

export default paymentRoutes;
