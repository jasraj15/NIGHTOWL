import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Lock, Wallet, Clock, ShieldCheck } from 'lucide-react';
import { Logo } from '../components/brand/Logo.js';
import { useAuth } from '../context/AuthContext.js';

const steps = [
  { icon: Users, title: 'Open or join a pool', text: 'Pick your hostel and retailer. Others in Uniworld 1 or 2 add their own items to the same cart.' },
  { icon: Clock, title: 'Beat the countdown', text: 'Every pool closes on a server-timed deadline. Watch the combined total climb toward the minimum.' },
  { icon: Lock, title: 'Host locks & orders', text: 'The host locks the cart, places the order in the retailer app, and records the real bill.' },
  { icon: Wallet, title: 'Pay your exact share', text: 'Fees are split proportionally to the paisa. Pay through Razorpay or a host-verified UPI reference.' },
];

const MARQUEE = ['Bhook lagi hai, yaar?', 'Chalo saath mein mangwate hain', 'Uniworld 1 × Uniworld 2', 'minus the delivery fees'];

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const cta = user ? (user.hostelSelected ? '/dashboard' : '/select-hostel') : '/auth?mode=register';

  return (
    <div className="dark min-h-dvh bg-[#0B0F19] text-[#F7F4EB]">
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative isolate flex min-h-dvh flex-col overflow-hidden">
        {/* Background photo: the hostel room at night */}
        <picture className="absolute inset-0 -z-20">
          <source media="(max-width: 640px)" srcSet="/hero-hostel-sm.jpg" />
          <img src="/hero-hostel.jpg" alt="" aria-hidden className="h-full w-full object-cover object-[70%_30%] sm:object-[100%_center]" fetchPriority="high" />
        </picture>
        {/* Legibility overlay — darker on the left where the headline sits */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#060911]/90 via-[#060911]/45 to-[#060911]/15" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-[75%] bg-gradient-to-t from-[#060911] via-[#060911]/85 to-transparent" aria-hidden />

        <header className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <nav className="flex items-center gap-2">
            {user ? (
              <Link to={cta} className="inline-flex h-11 items-center gap-2 rounded-full border border-[#F7F4EB]/50 px-5 text-sm font-semibold hover:border-lime hover:text-lime">
                Open app <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/auth?mode=login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[#F7F4EB]/80 hover:text-[#F7F4EB] sm:inline-flex">
                  Log in
                </Link>
                <Link to="/auth?mode=register" className="inline-flex h-11 items-center rounded-full bg-lime px-5 text-sm font-bold text-lime-ink shadow-glow hover:bg-lime-soft">
                  Join NightOwl
                </Link>
              </>
            )}
          </nav>
        </header>

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-5 pb-36 pt-10 sm:px-8 sm:pb-48 lg:pb-56">
          <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-lime/40 bg-[#060911]/50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-lime backdrop-blur">
            SST hostels · Uniworld 1 & 2 · @sst.scaler.com only
          </p>
          <h1 className="max-w-2xl font-display text-[2.4rem] font-black italic leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl animate-fade-up">
            Your midnight cravings, <span className="text-lime">together.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-[#F7F4EB]/80 sm:text-lg animate-fade-up">
            ₹80 of Maggi never meets a ₹300 minimum. Three people on your floor do. NightOwl turns a chaotic WhatsApp thread into one live shared cart, a countdown, and a
            fee split that adds up to the paisa.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center animate-fade-up">
            <Link
              to={cta}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 border-[#F7F4EB]/80 px-9 font-display text-lg font-bold italic text-[#F7F4EB] transition-colors hover:border-lime hover:bg-lime hover:text-lime-ink"
            >
              {user ? 'Go to dashboard' : 'Explore'} <ArrowRight className="h-5 w-5" />
            </Link>
            <a href="#how" className="inline-flex h-14 items-center justify-center px-4 text-sm font-semibold text-[#F7F4EB]/75 underline-offset-4 hover:text-[#F7F4EB] hover:underline">
              How a pool works
            </a>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-[#F7F4EB]/60">
            <ShieldCheck className="h-4 w-4 text-lime" /> Independent coordination tool — it never touches retailer carts or places orders for you.
          </p>
        </div>

        {/* Oversized scrolling strip, like the template's bottom marquee */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 select-none overflow-hidden pb-4" aria-hidden>
          <div className="flex w-max animate-marquee motion-reduce:animate-none whitespace-nowrap">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-baseline">
                {MARQUEE.map((t, i) => (
                  <span key={i} className="font-display text-[5.5rem] font-black italic leading-none tracking-tight text-[#F7F4EB] sm:text-[9rem] lg:text-[11rem]">
                    {t}
                    <span className="mx-8 text-lime sm:mx-12">·</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ How it works */}
      <section id="how" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime">How a pool works</p>
            <h2 className="mt-3 font-display text-4xl font-black italic leading-[1.05] sm:text-5xl">
              Four steps from <span className="text-lime">craving</span> to doorstep.
            </h2>
            <p className="mt-5 max-w-md text-[#F7F4EB]/70">
              Verified students only. The host places the real order; everyone sees the same cart, the same total and the same split — live.
            </p>
            <Link to={cta} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-lime px-6 text-sm font-bold text-lime-ink shadow-glow hover:bg-lime-soft">
              {user ? 'Open the app' : 'Verify your college email'} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-3xl border border-[#F7F4EB]/10 bg-[#0F1626] p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lime/10 text-lime">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-2xl font-black italic text-[#F7F4EB]/30">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mt-1.5 text-sm text-[#F7F4EB]/65">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ Example card */}
      <section className="border-t border-[#F7F4EB]/10 bg-[#060911]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div className="order-2 lg:order-1">
            <div className="relative mx-auto max-w-md rounded-3xl border border-[#F7F4EB]/10 bg-[#0F1626] p-6 shadow-card">
              <div className="flex items-center justify-between">
                <span className="rounded-md border border-[#9333EA]/40 bg-[#9333EA]/15 px-2 py-0.5 text-xs font-semibold text-[#B57BF5]">Zepto</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime/10 px-2.5 py-1 text-[11px] font-bold uppercase text-lime">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime animate-pulse" /> Open
                </span>
              </div>
              <h3 className="mt-4 font-display text-2xl font-bold italic">Late-night Maggi run · Tower B</h3>
              <p className="mt-1 text-sm text-[#F7F4EB]/60">Uniworld 1 · Lobby pickup · closes in 12:40</p>
              <div className="mt-5 rounded-xl border border-[#F7F4EB]/10 bg-[#0B0F19] p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[#F7F4EB]/60">Cart progress</span>
                  <span className="font-bold">
                    ₹330 <span className="text-[#F7F4EB]/40">/ ₹300</span>
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#060911]">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-lime to-ok" />
                </div>
                <p className="mt-2 text-xs font-semibold text-lime">Minimum reached · 4 students in</p>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  ['Asha', 'Maggi ×4, Lays', '₹80'],
                  ['Rohit', 'Cold drinks ×2', '₹100'],
                  ['Meera', 'Bread, eggs, milk', '₹150'],
                ].map(([n, items, amt]) => (
                  <li key={n} className="flex items-center justify-between rounded-lg border border-[#F7F4EB]/10 bg-[#0B0F19] px-3 py-2">
                    <span className="text-[#F7F4EB]/60">
                      <span className="font-semibold text-[#F7F4EB]">{n}</span> · {items}
                    </span>
                    <span className="font-mono font-semibold">{amt}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-2 text-center text-[11px] text-[#F7F4EB]/40">Illustrative example — every figure in the app comes from your own pools.</p>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime">Built for 1 am</p>
            <h2 className="mt-3 font-display text-4xl font-black italic leading-[1.05] sm:text-5xl">Better food, bigger carts, happier hostel life.</h2>
            <ul className="mt-6 space-y-3 text-[#F7F4EB]/75">
              <li>• Server-timed countdowns — nobody's phone clock decides when a pool closes.</li>
              <li>• Shared fees split in proportion to what each person ordered, rounded to the paisa.</li>
              <li>• Razorpay payments verified on the server, or a host-verified UPI reference when you'd rather pay direct.</li>
              <li>• A notification the moment someone joins, the cart locks, or your share is ready.</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#F7F4EB]/10 py-8 text-center text-xs text-[#F7F4EB]/45">
        © {new Date().getFullYear()} NightOwl · An independent student project ·{' '}
        <Link to="/legal" className="hover:text-[#F7F4EB]">
          Terms, privacy & community rules
        </Link>
      </footer>
    </div>
  );
};
