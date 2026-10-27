import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Origins
  CLIENT_URL: z.string().default('http://localhost:5173'),
  // Comma separated list of additional allowed origins (e.g. preview deployments)
  EXTRA_ALLOWED_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),

  // Database
  MONGODB_URI: z.string().default('mongodb://localhost:27017/nightowl'),

  // Sessions
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters')
    .default('super_secret_nightowl_jwt_key_change_in_production_32char'),
  // A cookie Domain of "localhost" is rejected by browsers and breaks 127.0.0.1 — ignore it.
  COOKIE_DOMAIN: z.preprocess(
    (v) => (typeof v === 'string' && /^(localhost|127\.0\.0\.1)$/i.test(v.trim()) ? undefined : emptyToUndefined(v)),
    z.string().optional()
  ),

  // Email (OTP)
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  EMAIL_FROM: z.string().default('NightOwl <onboarding@resend.dev>'),
  COLLEGE_EMAIL_DOMAIN: z.string().default('sst.scaler.com'),

  // Razorpay (server-side only — never shipped to the browser except RAZORPAY_KEY_ID)
  RAZORPAY_KEY_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  RAZORPAY_KEY_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  RAZORPAY_WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  // Razorpay Route (marketplace transfers to the pool host's linked account).
  // Requires an approved Route-enabled merchant account and KYC'd linked accounts.
  RAZORPAY_ROUTE_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),

  // Pool constraints
  POOL_MAX_DURATION_MINUTES: z.string().default('180').transform((v) => parseInt(v, 10)),
  POOL_MIN_DURATION_MINUTES: z.string().default('5').transform((v) => parseInt(v, 10)),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;

/**
 * Razorpay is "configured" only when both key id and secret are present.
 * Without them the app falls back to the clearly labelled MANUAL (host-verified UPI)
 * collection mode — it never fabricates a provider payment.
 */
export const razorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET.startsWith('super_secret_nightowl')) {
    console.warn('⚠️  JWT_SECRET is still the default value. Set a strong secret in production.');
  }
  if (!razorpayConfigured) {
    console.warn('⚠️  Razorpay keys are not configured. Payments will run in MANUAL (host-verified UPI) mode.');
  }
  if (razorpayConfigured && !env.RAZORPAY_WEBHOOK_SECRET) {
    console.warn('⚠️  RAZORPAY_WEBHOOK_SECRET missing. Webhooks will be rejected until it is set.');
  }
}
