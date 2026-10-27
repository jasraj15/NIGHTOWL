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
    <div className="min-h-dvh bg-canvas text-fg">
      <header className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link to={cta} className="inline-flex h-11 items-center gap-2 rounded-full bg-fg px-5 text-sm font-bold text-canvas hover:bg-pop hover:text-fg">
              Open app <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link to="/auth?mode=login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-fg/70 hover:text-fg sm:inline-flex">
                Log in
              </Link>
              <Link to="/auth?mode=register" className="inline-flex h-11 items-center rounded-full bg-fg px-5 text-sm font-bold text-canvas hover:bg-pop hover:text-fg">
                Join NightOwl
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* ------------------------------------------------------------ Hero */}
      <section className="night-sky -mt-20 pt-20"><div className="mx-auto max-w-7xl px-5 pb-10 pt-6 sm:px-8 sm:pt-10">
        <p className="inline-flex items-center gap-2 rounded-full bg-fg px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-canvas">
          SST hostels · Uniworld 1 & 2 · @sst.scaler.com only
        </p>
        <h1 className="display mt-6 max-w-5xl text-[3rem] font-black leading-[0.95] tracking-tight sm:text-7xl lg:text-[6.5rem] animate-fade-up">
          Your midnight cravings, <span className="italic text-pop">together.</span>
        </h1>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <p className="max-w-xl text-lg text-muted sm:text-xl">
            ₹80 of chips and a Coke never meets a ₹300 minimum. Three people on your floor do. NightOwl turns a chaotic WhatsApp thread into one live shared cart, a countdown, and a fee
            split that adds up to the paisa.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
            <Link to={cta} className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-fg px-9 text-base font-bold text-canvas transition-colors hover:bg-pop hover:text-fg">
              {user ? 'Go to dashboard' : 'Explore'} <ArrowRight className="h-5 w-5" />
            </Link>
            <a href="#how" className="inline-flex h-14 items-center justify-center rounded-full border-2 border-fg px-7 text-base font-bold text-fg transition-colors hover:bg-fg hover:text-canvas">
              How a pool works
            </a>
          </div>
        </div>
      </div></section>

      {/* Photo band with marquee */}
      <section className="relative mx-auto max-w-[96rem] px-3 sm:px-5">
        <div className="relative overflow-hidden rounded-[2rem] bg-fg">
          <picture>
            <source media="(max-width: 640px)" srcSet="/hero-hostel-sm.jpg" />
            <img src="/hero-hostel.jpg" alt="A hostel desk at night: chips, cold drinks and a laptop, with the NightOwl poster on the wall" className="h-[60vh] min-h-[420px] w-full object-cover object-[70%_35%] sm:h-[72vh]" fetchPriority="high" />
          </picture>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-fg/90 to-transparent" aria-hidden />
          <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-xs font-bold text-fg sm:left-8 sm:top-8">
            <ShieldCheck className="h-4 w-4" /> Independent coordination tool — never touches retailer carts
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 select-none overflow-hidden pb-2" aria-hidden>
            <div className="flex w-max animate-marquee motion-reduce:animate-none whitespace-nowrap">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 items-baseline">
                  {MARQUEE.map((t, i) => (
                    <span key={i} className="display text-[4.5rem] font-black leading-none tracking-tight text-canvas sm:text-[7.5rem] lg:text-[9.5rem]">
                      {t}
                      <span className="mx-8 text-pop sm:mx-12">·</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ How it works */}
      <section id="how" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pop">How a pool works</p>
            <h2 className="display mt-3 text-4xl font-black leading-[1] sm:text-5xl">
              Four steps from <span className="italic text-pop">craving</span> to doorstep.
            </h2>
            <p className="mt-5 max-w-md text-muted">Verified students only. The host places the real order; everyone sees the same cart, the same total and the same split — live.</p>
            <Link to={cta} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-fg px-6 text-sm font-bold text-canvas hover:bg-pop hover:text-fg">
              {user ? 'Open the app' : 'Verify your college email'} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className={['rounded-3xl p-6 text-fg', ['bg-sun', 'bg-blush', 'bg-sky', 'bg-mint'][i % 4]].join(' ')}>
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-fg text-canvas">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="display text-2xl font-black opacity-40">0{i + 1}</span>
                </div>
                <h3 className="display mt-5 text-xl font-bold">{title}</h3>
                <p className="mt-1.5 text-sm text-fg/70">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ Example card */}
      <section className="bg-fg text-canvas">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div className="order-2 lg:order-1">
            <div className="relative mx-auto max-w-md rounded-3xl bg-surface p-6 text-fg shadow-card">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-pop/15 px-2.5 py-0.5 text-xs font-bold text-pop">Zepto</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-fg px-2.5 py-1 text-[11px] font-bold uppercase text-canvas">
                  <span className="h-1.5 w-1.5 rounded-full bg-canvas animate-pulse" /> Open
                </span>
              </div>
              <h3 className="display mt-4 text-2xl font-bold">Late-night chips & Coke run · Tower B</h3>
              <p className="mt-1 text-sm text-muted">Uniworld 1 · Lobby pickup · closes in 12:40</p>
              <div className="mt-5 rounded-2xl bg-overlay p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Cart progress</span>
                  <span className="font-bold">
                    ₹330 <span className="text-faint">/ ₹300</span>
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white">
                  <div className="h-full w-full rounded-full bg-pop" />
                </div>
                <p className="mt-2 text-xs font-bold text-pop">Minimum reached · 4 students in</p>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  ['Asha', 'Lays ×2, Kurkure', '₹80'],
                  ['Rohit', 'Coke 750ml ×2', '₹100'],
                  ['Meera', 'Chocolates, biscuits', '₹150'],
                ].map(([n, items, amt]) => (
                  <li key={n} className={["flex items-center justify-between rounded-xl px-3 py-2", ["bg-sun/60","bg-sky","bg-mint"][["Asha","Rohit","Meera"].indexOf(n)]].join(" ")}>
                    <span className="text-muted">
                      <span className="font-semibold text-fg">{n}</span> · {items}
                    </span>
                    <span className="font-mono font-semibold">{amt}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-2 text-center text-[11px] text-canvas/60">Illustrative example — every figure in the app comes from your own pools.</p>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pop">Built for 1 am</p>
            <h2 className="display mt-3 text-4xl font-black leading-[1] sm:text-5xl">Better food, bigger carts, happier hostel life.</h2>
            <ul className="mt-6 space-y-3 text-canvas/80">
              <li>• Server-timed countdowns — nobody's phone clock decides when a pool closes.</li>
              <li>• Shared fees split in proportion to what each person ordered, rounded to the paisa.</li>
              <li>• Razorpay payments verified on the server, or a host-verified UPI reference when you'd rather pay direct.</li>
              <li>• A notification the moment someone joins, the cart locks, or your share is ready.</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} NightOwl · An independent student project ·{' '}
        <Link to="/legal" className="underline hover:text-fg">
          Terms, privacy & community rules
        </Link>
      </footer>
    </div>
  );
};
