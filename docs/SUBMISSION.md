# NightOwl — End-term submission

> Fill in the remaining bracketed fields (name, video) before submitting.

| Field | Value |
|---|---|
| **Project Name** | NightOwl — Your midnight cravings, together |
| **Student Name** | Jasraj |
| **Problem Statement** | Hostel students in Uniworld 1 & 2 can't meet quick-commerce minimum order values alone and pay full delivery fees per order. NightOwl lets verified `@sst.scaler.com` students pool items into one live shared cart with a server-timed countdown, lets the host record the real bill, splits fees proportionally to the paisa, and collects each share through verified Razorpay payments (or host-verified UPI). |
| **GitHub Repository** | https://github.com/jasraj15/NIGHTOWL |
| **Deployed Application** | Frontend: https://nightowl-tau.vercel.app · API health: https://nightowl-api-vljl.onrender.com/api/v1/health |
| **Demo Video** | [YouTube / Loom link, 3–5 min] |
| **Tech Stack** | React 18 + Vite + TypeScript + Tailwind + React Router + Socket.IO client · Node.js + Express + TypeScript + MongoDB Atlas + Mongoose + Socket.IO + Zod + Razorpay (REST + HMAC) + Resend · Vitest + Supertest · Vercel / Render |
| **Major Features** | Email-OTP verification restricted to college domain · hostel onboarding · dashboard with real-data summaries, recommendations and filters · dedicated Create Pool with server-timed countdown · live collaborative cart over authenticated Socket.IO rooms · full order lifecycle with validated transitions, audit trail, reopen/extend/cancel · proportional paise-exact cost split · Razorpay checkout with server-side signature verification, provider confirmation and idempotent webhooks + manual UPI fallback · orders history with tabs and "order again" drafts · persisted notification centre with preferences · settings (profile, privacy, payments history, dark/light/system theme, deactivation) · reports & moderator endpoints · 60+ automated backend tests |

## Final checklist

- [x] `npm install && npm test` passes locally (record output in `docs/VERIFICATION.md`)
- [x] `npm run build` succeeds for both workspaces
- [x] `server/.env` is **not** committed; `.env.example` files are up to date
- [x] Repository pushed to GitHub with incremental commits
- [x] Backend deployed on Render with Atlas URI, generated JWT secret, `CLIENT_URL`, `OTP_FALLBACK_DISPLAY=true` (no Resend domain / Razorpay keys yet → on-screen OTP, manual UPI payment mode)
- [x] Frontend deployed on Vercel with `VITE_API_URL`
- [ ] Razorpay webhook registered (pending test keys) at `https://<api>/api/v1/payments/razorpay/webhook`
- [x] Health check https://nightowl-api-vljl.onrender.com/api/v1/health returns `"status":"ok"`, `"database":"connected"` (27 Oct 2026)
- [x] Smoke test on the deployed app (27 Oct 2026): register → OTP → hostel → dashboard → create pool → live pool page (socket connected, countdown) → cancel. Full lifecycle verified locally in `docs/VERIFICATION.md`.
- [ ] Demo video recorded (see `DEMO_VIDEO_OUTLINE.md`) and linked above
- [ ] Student name, repo URL, deployed URL and video URL filled in above and in `README.md`
- [ ] Official submission form completed
