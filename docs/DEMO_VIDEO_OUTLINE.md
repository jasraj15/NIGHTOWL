# NightOwl — demo video outline (3–5 minutes)

Record on a laptop with a phone-sized second window (or a real phone) so the live sync is visible. Seed first: `npm run seed && npm run dev`.

| Time | Scene | What to show / say |
|---|---|---|
| 0:00–0:30 | **The problem** | Landing page. "₹80 of chips and a Coke never meets a ₹300 minimum. Three people on one floor do — but WhatsApp threads lose track of who owes what." |
| 0:30–1:10 | **Verified onboarding** | Register with a fresh `@sst.scaler.com` email → show a Gmail address being rejected → OTP (dev hint on screen / Resend email) → hostel-selection screen → dashboard greeting with your hostel. Mention HttpOnly cookie session surviving a refresh. |
| 1:10–1:50 | **Create a pool** | Create Pool page: Zepto, ₹300 minimum, 15-minute countdown, pickup spot, delivery confirmation checkbox. Point out "countdown starts from the server clock". Add one item. |
| 1:50–2:40 | **Live collaborative cart** | Second window: log in as `priya.demo@sst.scaler.com`, open Discover (recommended pool with reasons), join with delivery confirmation, add two items. Cut back to window 1: items, total, progress bar and participant list update without refresh. Edit/remove an item; show a non-owner can't edit it. |
| 2:40–3:30 | **Lock, order, split** | Host locks (show the below-target confirmation if applicable). "I placed the order": bill ₹330, delivery ₹30. Show the breakdown table — fees split proportionally, paise-exact. Notification pops for Priya. |
| 3:30–4:20 | **Payment** | As Priya: Pay with Razorpay (test card 4111 1111 1111 1111, any future expiry/CVV) → success only after server verification → payment ID visible. Or: submit UPI reference and confirm as host. Show host view with outstanding balance. Mark delivered → confetti. |
| 4:20–4:50 | **History & settings** | Orders tabs, "Order again" draft, Notifications inbox, Settings → theme switch to light, Payments history with transaction reference. |
| 4:50–5:00 | **Engineering close** | One screen of `npm test` output (60+ tests: OTP, concurrency, signatures, duplicate webhooks) and the README architecture diagram. "NightOwl coordinates — it never touches retailer carts, and it never says money moved unless the provider confirmed it." |

Tips: keep both windows at 1280×800 or narrower so text is legible; mute toasts' overlap by acting slowly; pre-type the OTP flow once before recording.
