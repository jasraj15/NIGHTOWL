import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/brand/Logo.js';

export const LegalPage: React.FC = () => (
  <div className="min-h-dvh">
    <header className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
      <Logo />
      <Link to="/" className="text-sm font-semibold text-muted hover:text-fg">
        Back
      </Link>
    </header>
    <main className="prose-invert mx-auto max-w-3xl px-4 pb-20 pt-6 text-sm text-muted">
      <h1 className="text-3xl font-extrabold text-fg">Terms, privacy & community rules</h1>
      <p className="mt-2">NightOwl is a student-built coordination tool. Please read this once — it is short.</p>

      <section id="terms" className="mt-10">
        <h2 className="text-xl font-bold text-fg">Terms of use</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>NightOwl only coordinates group orders between verified students. It does not place orders with Blinkit, Zepto, Flipkart Minutes or any retailer, and it has no access to their carts, prices, stock or delivery availability.</li>
          <li>The pool host places the retailer order themselves and records the real bill. NightOwl cannot guarantee that a pool's target amount matches a retailer's actual minimum order value.</li>
          <li>Online payments are processed by Razorpay. NightOwl never sees or stores card numbers, UPI PINs or bank passwords. Manual UPI references are verified by the pool host, not by NightOwl.</li>
          <li>Accounts are limited to @sst.scaler.com addresses verified by email code. Phone numbers are collected for coordination but are not verified.</li>
        </ul>
      </section>

      <section id="privacy" className="mt-10">
        <h2 className="text-xl font-bold text-fg">Privacy policy</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>We store your name, college email, phone number, hostel, preferences, the pools and items you add, payment references and provider transaction IDs.</li>
          <li>Your phone number is hidden from other students unless you turn on “Show my phone to pool members” in Settings — and then only for members of pools you host.</li>
          <li>Payment references and transaction IDs are visible only to you and the host of that pool.</li>
          <li>Deactivating your account removes your personal details and keeps anonymised order and payment history for the other participants' records.</li>
        </ul>
      </section>

      <section id="rules" className="mt-10">
        <h2 className="text-xl font-bold text-fg">Community rules</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Add only items you intend to pay for. Pay your share promptly once the host records the order.</li>
          <li>Hosts: record the real bill and fees honestly. Fee splitting is proportional to each person's item subtotal and shown to everyone.</li>
          <li>No abusive, misleading or inappropriate content. Use the Report button on a pool for suspicious payment claims or abusive behaviour; moderators review reports.</li>
          <li>Repeated no-shows or non-payment may lead to account deactivation.</li>
        </ul>
      </section>
    </main>
  </div>
);
