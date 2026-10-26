import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/nightowl'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('super_secret_nightowl_jwt_key_change_in_production_32char'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  COOKIE_DOMAIN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('NightOwl <onboarding@resend.dev>'),
  COLLEGE_EMAIL_DOMAIN: z.string().default('sst.scaler.com'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
