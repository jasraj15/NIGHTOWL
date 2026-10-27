# Verification record — 27 Oct 2026

Everything below was actually executed on the development machine (macOS arm64, Node 26.12.1, npm 11.20.0, local MongoDB 7 via Homebrew) on the day of submission.

## Automated tests (`npm test` → Vitest + Supertest, in-memory MongoDB)

```
 ✓ src/tests/auth.test.ts          (25 tests)
 ✓ src/tests/notifications.test.ts  (2 tests)
 ✓ src/tests/items.test.ts          (6 tests)
 ✓ src/tests/pools.test.ts         (16 tests)
 ✓ src/tests/payments.test.ts      (14 tests)
 ✓ src/tests/costSplit.test.ts      (3 tests)

 Test Files  6 passed (6)
      Tests  66 passed (66)
   Duration  ~8.5 s
```

## Type checks & builds

| Command | Result |
|---|---|
| `npx tsc --noEmit -p server` | OK (0 errors) |
| `npm run build --workspace=server` | OK → `server/dist/` |
| `npx tsc --noEmit -p client` (strict, noUnusedLocals) | OK (0 errors) |
| `npx vite build` (client) | OK → `dist/assets/index-*.js` 389 kB (117 kB gzip), CSS 34 kB |

## Manual end-to-end run (dev servers: API on :5050, Vite on :5173, local MongoDB)

Performed in the Claude desktop app's built-in browser plus a second "student" driven through the REST API with `curl` (cookie jar) to simulate another phone.

1. Landing page renders; "Join NightOwl" → registration with name / `@sst.scaler.com` email / Indian phone / rules checkbox.
2. OTP generated (dev fallback shown on screen and in server log); wrong-domain emails are rejected client- and server-side.
3. After verification the **hostel-selection screen** appears; choosing Uniworld 1 persists and lands on the dashboard (greeting, hostel, summary cards, filters, live badge).
4. **Create Pool** page: Zepto, ₹300 minimum, pickup spot, delivery-confirmation checkbox, 20-minute preset → pool created, server-timed countdown shown.
5. Host adds "Maggi Masala 4-pack ×2 @ ₹56" via the item modal → cart ₹112.
6. Second student (Priya) registers, verifies, selects hostel, **joins** with delivery confirmation and adds two items through the API → the host's open page updated **live** (participants 2/8, cart ₹262, items grouped by person, notification badge) without a refresh.
7. **Lock cart**: because ₹262 < ₹300 the dialog required the explicit "I've confirmed in the Zepto app…" checkbox before enabling Lock.
8. **I placed the order**: delivery ₹30, other ₹8, final ₹300, UPI id → status ORDERED; breakdown table showed You ₹112 + ₹16.24 = ₹128.24 and Priya ₹150 + ₹21.76 = ₹171.76 (sums to ₹300 exactly).
9. Priya submitted UPI reference `329012345678` (manual fallback; Razorpay keys not configured) → host saw "Processing · UTR …" with Confirm/Reject live; host confirmed → PAID; notifications were created for both.
10. **Mark delivered** → DELIVERED with confetti; Orders → Completed tab lists the order with my items, shared fees, my share; **Order again** opened a new draft with the items carried over and the original untouched.
11. Settings → Appearance: Light theme applied instantly across the app and persisted to the profile; switched back to Dark. Notifications page listed the three events; mobile viewport (375×812) renders the bottom tab bar correctly.
12. Browser console: no application errors (only the expected 401 from the pre-login session probe).

## Not verified live

* **Razorpay Checkout against the real sandbox** — no test keys were available on the machine during verification. The order-creation, signature-verification, provider-confirmation, amount-mismatch, duplicate-webhook and failed-webhook paths are exercised by `payments.test.ts` with the Razorpay HTTP API mocked and the real HMAC code running. Follow `docs/PAYMENTS.md` to run it with `rzp_test_` keys.
* **Resend email delivery** — no API key configured; the console/`debugOtp` fallback was used.
* **Deployment** — prepared (`render.yaml`, `vercel.json`, `docs/DEPLOYMENT.md`) but not performed.
