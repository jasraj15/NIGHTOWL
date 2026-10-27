import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { generalApiLimiter, webhookLimiter } from './middlewares/rateLimiter.js';
import { sanitizeRequest } from './middlewares/sanitize.js';
import { buildApiRouter } from './routes/index.js';
import { razorpayWebhook } from './controllers/paymentController.js';
import { getAllowedOrigins } from './utils/origins.js';

export const app = express();

// Behind Render/Vercel proxies: trust the first hop so req.ip and secure cookies behave.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false, // API only; the SPA sets its own policy
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const allowedOrigins = getAllowedOrigins();
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin / server-to-server requests without an Origin header (e.g. webhooks, curl).
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(cookieParser());

/**
 * Razorpay webhook: must receive the RAW body so the HMAC can be computed over the exact bytes.
 * Mounted BEFORE express.json() so the JSON parser never touches it.
 */
app.post('/api/v1/payments/razorpay/webhook', webhookLimiter, express.raw({ type: '*/*', limit: '256kb' }), razorpayWebhook);
app.post('/api/payments/razorpay/webhook', webhookLimiter, express.raw({ type: '*/*', limit: '256kb' }), razorpayWebhook);

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(sanitizeRequest);

if (env.NODE_ENV === 'production') {
  app.use('/api', generalApiLimiter);
}

// Versioned API (+ unversioned alias for older clients)
app.use('/api/v1', buildApiRouter());
app.use('/api', buildApiRouter());

app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);
