import crypto from 'crypto';
import { env, razorpayConfigured } from '../config/env.js';

/**
 * Minimal, dependency-free Razorpay REST client.
 *
 * Why not the `razorpay` npm SDK? The SDK is a thin wrapper over the same REST endpoints and
 * the same HMAC-SHA256 checks used here. Implementing the three calls NightOwl needs with
 * Node's built-in `fetch` + `crypto` keeps the dependency surface small and makes every
 * security-relevant line auditable in this file. Swapping in the SDK later is a one-file change.
 *
 * Secrets (`RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) never leave the server.
 */

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

export interface RazorpayOrder {
  id: string;
  entity: 'order';
  amount: number; // paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: 'created' | 'attempted' | 'paid';
  notes?: Record<string, string>;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  entity: 'payment';
  amount: number; // paise
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id?: string;
  method?: string;
  captured: boolean;
  email?: string;
  contact?: string;
  error_code?: string | null;
  error_description?: string | null;
  notes?: Record<string, string>;
  created_at: number;
}

export interface CreateOrderInput {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
  /** Razorpay Route transfer to a linked account (only when Route is enabled & approved). */
  transferToLinkedAccountId?: string;
}

export class RazorpayError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = 'RazorpayError';
    this.statusCode = statusCode;
  }
}

function basicAuthHeader(): string {
  const token = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

async function razorpayRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!razorpayConfigured) {
    throw new RazorpayError('Razorpay is not configured on this server.', 503);
  }

  const res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const description = body?.error?.description || body?.error?.reason || `Razorpay API error (${res.status})`;
    throw new RazorpayError(description, res.status >= 500 ? 502 : 400);
  }

  return body as T;
}

/** Step 3 of the payment flow: create an order server-side with the server-computed amount. */
export async function createRazorpayOrder(input: CreateOrderInput): Promise<RazorpayOrder> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < 100) {
    // Razorpay minimum is ₹1.00
    throw new RazorpayError('Order amount must be at least ₹1.00', 400);
  }

  const payload: Record<string, unknown> = {
    amount: input.amountPaise,
    currency: 'INR',
    receipt: input.receipt.slice(0, 40),
    notes: input.notes || {},
  };

  if (input.transferToLinkedAccountId) {
    payload.transfers = [
      {
        account: input.transferToLinkedAccountId,
        amount: input.amountPaise,
        currency: 'INR',
        notes: input.notes || {},
        on_hold: false,
      },
    ];
  }

  return razorpayRequest<RazorpayOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Step 8: confirm the payment status directly with Razorpay (never trust the browser alone). */
export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    throw new RazorpayError('Invalid payment id format', 400);
  }
  return razorpayRequest<RazorpayPayment>(`/payments/${paymentId}`, { method: 'GET' });
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Step 7: Checkout signature verification.
 * expected = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string | undefined = env.RAZORPAY_KEY_SECRET
): boolean {
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return timingSafeEqualHex(expected, signature);
}

/**
 * Step 11: Webhook signature verification over the RAW request body.
 * expected = HMAC_SHA256(raw_body, webhook_secret)
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string | undefined,
  secret: string | undefined = env.RAZORPAY_WEBHOOK_SECRET
): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqualHex(expected, signature);
}

/** Convenience for the frontend config endpoint. */
export function getPublicPaymentConfig() {
  return {
    provider: razorpayConfigured ? ('razorpay' as const) : ('manual' as const),
    keyId: razorpayConfigured ? env.RAZORPAY_KEY_ID : null,
    routeEnabled: razorpayConfigured && env.RAZORPAY_ROUTE_ENABLED,
    testMode: razorpayConfigured ? Boolean(env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')) : null,
    manualFallbackAvailable: true,
  };
}
