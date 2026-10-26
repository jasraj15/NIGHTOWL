import { Router } from 'express';
import { submitPaymentReference, reviewPayment } from '../controllers/paymentController.js';
import { requireAuth, requireVerifiedCollegeEmail } from '../middlewares/auth.js';

const router = Router();

// Participant submits their UPI reference
router.post('/:poolId/payment', requireAuth, requireVerifiedCollegeEmail, submitPaymentReference);

// Owner confirms or rejects participant's payment
router.post(
  '/:poolId/payment/:paymentId/review',
  requireAuth,
  requireVerifiedCollegeEmail,
  reviewPayment
);

export default router;
