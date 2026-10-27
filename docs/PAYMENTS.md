# Payments in NightOwl

## Goals
* A participant pays exactly the amount the server computed — never a client-supplied number.
* The UI shows "Paid" only after the server has verified the provider's signature **and** confirmed the payment with Razorpay.
* Every provider event is processed exactly once; retries and duplicate webhooks are harmless.
* No card numbers, CVVs, UPI PINs or bank credentials ever touch NightOwl.

## Amount computation
When the host records the retailer order (`POST /pools/:id/order-placed`) the server:
1. Sums each participant's items (`PoolItem.itemSubtotal`, computed server-side as `quantity × unitPrice`).
2. Computes shared fees = `finalPayableAmount − itemsSubtotal` (or `deliveryFee + otherCharges` when no final total is given).
3. Allocates fees **proportionally to item subtotal** in integer paise using the largest-remainder method, so `Σ totalDue == finalPayableAmount` exactly (`services/costSplitService.ts`, tested in `costSplit.test.ts` and `payments.test.ts`).
4. Upserts one `PaymentRecord` per participant with `itemSubtotal`, `allocatedFee`, `totalDue` and the authoritative integer `amountPaise`. Records already `PAID` are never changed.

The breakdown table is returned to every member so the split is transparent.

## Razorpay Checkout flow (steps map to the task specification)
| Step | Where | What |
|---|---|---|
| 1 | Client | Participant clicks **Pay** on an `ORDERED`/`DELIVERED` pool. |
| 2–3 | `createPaymentOrder` | Server loads the participant's `PaymentRecord`, refuses if host/non-member/already paid, creates a Razorpay **order** for `amountPaise` using the key secret (Basic auth over HTTPS), stores `razorpayOrderId`, sets `PROCESSING`. An existing unpaid order is reused. |
| 4–5 | Client | `checkout.js` opens with `order_id` and the **public** key id. The participant pays. |
| 6 | Client → `verifyPaymentCheckout` | Sends `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`. |
| 7 | Server | Confirms the order id matches **this user's** record, then verifies `HMAC_SHA256(order_id + "|" + payment_id, key_secret)` with a constant-time compare. Failures are audited (`PAYMENT_SIGNATURE_INVALID`). |
| 8 | Server | `GET /v1/payments/:id` from Razorpay; requires `status: captured`, matching `order_id` and `amount === amountPaise`. |
| 9 | Server | `applyCapturedPayment` writes a `PaymentEvent` (unique `providerEventId`) and conditionally updates the record to `PAID` (`paymentStatus != PAID`), audits `PAYMENT_VERIFIED`, notifies payer and host. |
| 10 | Client | Shows success only from the server's response. |
| 11 | Webhook | `POST /payments/razorpay/webhook` is mounted **before** the JSON parser with `express.raw`, verifies `HMAC_SHA256(rawBody, webhook_secret)`, and uses the `x-razorpay-event-id` (or a body hash) as the idempotency key. `payment.captured`/`order.paid` → same `applyCapturedPayment`; `payment.failed` → `FAILED` (never downgrading `PAID`); `refund.*` → `REFUND_PENDING`/`REFUNDED`. |

Statuses: `PENDING → PROCESSING → PAID | FAILED`, and `PAID → REFUND_PENDING → REFUNDED` via webhooks.

## Who receives the money?
A standard Checkout payment is settled to the **merchant account whose keys the server uses** — i.e. the platform, not the student who created the pool.

Options for getting funds to the host:
1. **Razorpay Route (recommended for a real deployment).** Requires a Route-enabled merchant account, and each host onboarded as a *linked account* with KYC. NightOwl already supports this: set `RAZORPAY_ROUTE_ENABLED=true` and store the host's `acc_…` id in `User.razorpayLinkedAccountId`; orders are then created with a `transfers[]` entry for the full amount. Linked-account onboarding (collecting bank details and KYC) is intentionally **not** built into NightOwl's UI — it must go through Razorpay's flow.
2. **Platform settles manually** to hosts outside the app.
3. **Manual UPI fallback** (always available, clearly labelled): the host shares a UPI ID, the participant pays in their UPI app and submits the UTR, the host confirms receipt in NightOwl. The status is explicitly "host-verified"; NightOwl never claims the transfer happened on its own.

NightOwl never tells a user that funds reached a student's account unless that is what the configured provider workflow (Route transfer) reports.

## Test mode
1. Put `rzp_test_…` keys and a webhook secret in `server/.env`.
2. Run the app; the Payments panel shows the **"Razorpay · test mode"** badge.
3. Pay with Razorpay test instruments (card `4111 1111 1111 1111`, UPI `success@razorpay`, or `failure@razorpay` to see the failure path).
4. For webhooks on localhost, expose the API with a tunnel (e.g. `ngrok http 5000`) and register `https://<tunnel>/api/v1/payments/razorpay/webhook`.

Without keys, `GET /payments/config` reports `provider: "manual"` and the UI shows only the UPI-reference flow.

## Live mode & compliance notes
* Complete Razorpay KYC; switch to live keys and a live webhook.
* Settlement timing and fees follow your Razorpay plan; refunds must be initiated from the Razorpay dashboard/API (NightOwl records the resulting webhooks).
* Keep `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` server-side only; rotate them if a `.env` is ever exposed.
* Collecting money on behalf of others may have regulatory implications (marketplace/aggregator rules); Route is the compliant path for routing funds to third parties.
