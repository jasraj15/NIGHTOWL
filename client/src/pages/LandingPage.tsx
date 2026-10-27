import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Lock, Wallet, Clock, ShieldCheck, Moon } from 'lucide-react';
import { Logo, OwlMark } from '../components/brand/Logo.js';
import { useAuth } from '../context/AuthContext.js';

const steps = [
  { icon: Users, title: 'Open or join a pool', text: 'Pick your hostel and retailer. Others in Uniworld 1 or 2 add their own items to the same cart.' },
  { icon: Clock, title: 'Beat the countdown', text: 'Every pool closes on a server-timed deadline. Watch the combined total climb toward the minimum.' },
  { icon: Lock, title: 'Host locks & orders', text: 'The host locks the cart, places the order in the retailer app, and records the real bill.' },
  { icon: Wallet, title: 'Pay your exact share', text: 'Fees are split proportionally to the paisa. Pay through Razorpay or a host-verified UPI reference.' },
];

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const cta = user ? (user.hostelSelected ? '/dashboard' : '/select-hostel') : '/auth?mode=register';

  return (
    <div className="night-sky min-h-dvh">
      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          {user ? (
            <Link to={cta} className="inline-flex h-10 items-center gap-2 rounded-xl bg-lime px-4 text-sm font-bold text-lime-ink shadow-glow">
              Open app <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link to="/auth?mode=login" className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:text-fg">
                Log in
              </Link>
              <Link to="/auth?mode=register" className="inline-flex h-10 items-center rounded-xl bg-lime px-4 text-sm font-bold text-lime-ink shadow-glow hover:bg-lime-soft">
                Join NightOwl
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-xs font-bold text-lime">
              <Moon className="h-3.5 w-3.5" /> For Uniworld 1 & Uniworld 2 · @sst.scaler.com only
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-fg sm:text-6xl">
              Your midnight cravings, <span className="text-lime">together.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
              ₹80 of snacks never meets a ₹300 minimum. Pool it with the floor: combine small Blinkit, Zepto and Flipkart Minutes orders into one shared cart, track every
              rupee live, and split the fees fairly.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={cta} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-6 text-base font-bold text-lime-ink shadow-glow hover:bg-lime-soft">
                {user ? 'Go to dashboard' : 'Verify your college email'} <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="#how" className="inline-flex h-12 items-center justify-center rounded-xl border border-line-strong px-6 text-base font-semibold text-fg hover:bg-overlay">
                How it works
              </a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-faint">
              <ShieldCheck className="h-4 w-4 text-lime" /> NightOwl coordinates group orders; it never accesses retailer carts or places orders for you.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md animate-fade-up">
            <div className="card relative overflow-hidden p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-md border border-[#9333EA]/40 bg-[#9333EA]/15 px-2 py-0.5 text-xs font-semibold text-[#B57BF5]">Zepto</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime/10 px-2.5 py-1 text-[11px] font-bold uppercase text-lime">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime animate-pulse" /> Open
                </span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-fg">Late-night Maggi run · Tower B</h3>
              <p className="mt-1 text-sm text-muted">Uniworld 1 · Lobby pickup · closes in 12:40</p>
              <div className="mt-5 rounded-xl border border-line bg-base/60 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Cart progress</span>
                  <span className="font-bold text-fg">
                    ₹330 <span className="text-faint">/ ₹300</span>
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-base">
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
                  <li key={n} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2">
                    <span className="text-muted">
                      <span className="font-semibold text-fg">{n}</span> · {items}
                    </span>
                    <span className="font-mono font-semibold text-fg">{amt}</span>
                  </li>
                ))}
              </ul>
              <OwlMark className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 opacity-10" />
            </div>
            <p className="mt-2 text-center text-[11px] text-faint">Illustrative example — all real figures in the app come from your pools.</p>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-extrabold text-fg sm:text-3xl">How a pool works</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime/10 text-lime">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-mono text-xs text-faint">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-bold text-fg">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-faint">
        © {new Date().getFullYear()} NightOwl · An independent student project ·{' '}
        <Link to="/legal" className="hover:text-fg">
          Terms, privacy & community rules
        </Link>
      </footer>
    </div>
  );
};
