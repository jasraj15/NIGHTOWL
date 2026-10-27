# Deploying NightOwl

Target topology: **Vercel** (SPA) ⇄ **Render** (API + Socket.IO) ⇄ **MongoDB Atlas**, with **Resend** for OTP email and **Razorpay** for payments.

## 1. MongoDB Atlas
1. Create a free M0 cluster, a database user, and allow network access from Render (or `0.0.0.0/0` for a demo).
2. Copy the SRV URI and append the database name: `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/nightowl?retryWrites=true&w=majority`.

## 2. Backend on Render
`render.yaml` at the repo root describes the service; or create it manually:

| Setting | Value |
|---|---|
| Root directory | repository root (workspaces) |
| Build command | `npm install && npm run build --workspace=server` |
| Start command | `npm run start --workspace=server` |
| Health check path | `/api/v1/health` |

Environment variables:

```
NODE_ENV=production
PORT=10000
MONGODB_URI=<atlas uri>
JWT_SECRET=<32+ random chars>
CLIENT_URL=https://<your-app>.vercel.app
EXTRA_ALLOWED_ORIGINS=https://<preview>.vercel.app   # optional
RESEND_API_KEY=re_...
EMAIL_FROM=NightOwl <noreply@your-verified-domain>
COLLEGE_EMAIL_DOMAIN=sst.scaler.com
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_ROUTE_ENABLED=false
```

The server sets `trust proxy = 1` so secure cookies and rate limiting work behind Render's proxy. Socket.IO shares the HTTP port and the same CORS allow-list.

### OTP without a verified email domain

Resend's shared `onboarding@resend.dev` sender only delivers to the Resend account's own address, so other students' codes would never arrive. For the evaluation deployment set `OTP_FALLBACK_DISPLAY=true` (already in `render.yaml`): the API keeps `NODE_ENV=production` (Secure, SameSite=None cookies) but returns the code to the browser, where the login screen shows it with a "development fallback" label. Once a domain is verified in Resend, set `RESEND_API_KEY` and flip the flag to `false`.

## 3. Frontend on Vercel
| Setting | Value |
|---|---|
| Root directory | `client` |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Env | `VITE_API_URL=https://<your-api>.onrender.com` |

`client/vercel.json` rewrites every path to `index.html` for client-side routing. After the first deploy, put the final Vercel URL into the backend's `CLIENT_URL` and redeploy the API.

## 4. Cross-origin cookies (important)
* The session cookie is set with `HttpOnly; Secure; SameSite=None` in production, which is what a cross-site Vercel → Render request needs. Browsers only send it over HTTPS and only when the API responds with `Access-Control-Allow-Origin: <exact frontend origin>` and `Access-Control-Allow-Credentials: true` — both are configured from `CLIENT_URL`.
* The frontend always calls `fetch(..., { credentials: 'include' })` and `io(url, { withCredentials: true })`.
* Some privacy modes (Safari ITP, Brave shields) block third-party cookies. To be immune, serve the API from a subdomain of the frontend (e.g. `api.nightowl.example` + `app.nightowl.example`) and set `COOKIE_DOMAIN=nightowl.example`.

## 5. Razorpay
1. Dashboard → **Settings → API Keys** → generate **test** keys (`rzp_test_…`). Put them in `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
2. **Settings → Webhooks** → add `https://<your-api>.onrender.com/api/v1/payments/razorpay/webhook`, choose a secret (→ `RAZORPAY_WEBHOOK_SECRET`), enable `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`.
3. Test cards / UPI: any Razorpay test instrument (e.g. card `4111 1111 1111 1111`, any future expiry, any CVV; UPI `success@razorpay`).
4. Going live: complete KYC, generate live keys, re-register the webhook in live mode, and read `docs/PAYMENTS.md` about settlement to hosts (Razorpay Route) before enabling `RAZORPAY_ROUTE_ENABLED`.

## 6. Resend
Verify your sending domain in Resend and set `EMAIL_FROM` to an address on it. Without a key the API prints OTPs to its logs (development only — never rely on this in production).

## 7. Smoke test after deploy
```
curl https://<api>/api/v1/health            # "status":"ok", "database":"connected"
```
Then register from the Vercel URL, confirm the cookie is set (DevTools → Application), create a pool and open it from a second account to see live updates over the websocket.
