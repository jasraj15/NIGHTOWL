import { Router } from 'express';
import {
  register,
  requestLoginOtp,
  verifyOtpHandler,
  resendOtp,
  getMe,
  logout,
} from '../controllers/authController.js';
import { requireAuth } from '../middlewares/auth.js';
import { authRateLimiter, otpRequestLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

router.post('/register', authRateLimiter, otpRequestLimiter, register);
router.post('/login-request', authRateLimiter, otpRequestLimiter, requestLoginOtp);
router.post('/verify-otp', authRateLimiter, verifyOtpHandler);
router.post('/resend-otp', otpRequestLimiter, resendOtp);

router.get('/me', requireAuth, getMe);
router.post('/logout', requireAuth, logout);

export default router;
