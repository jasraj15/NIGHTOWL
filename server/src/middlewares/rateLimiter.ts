import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// Rate limits are disabled in the automated test environment so suites stay deterministic.
const skip = () => env.NODE_ENV === 'test';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip,
  message: { success: false, error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpRequestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 6,
  skip,
  message: { success: false, error: 'Too many OTP requests. Please wait 5 minutes before requesting again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const paymentActionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  skip,
  message: { success: false, error: 'Too many payment attempts. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  skip,
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  skip,
  message: { success: false, error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
