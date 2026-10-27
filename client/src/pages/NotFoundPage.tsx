import React from 'react';
import { Link } from 'react-router-dom';
import { OwlMark } from '../components/brand/Logo.js';

export const NotFoundPage: React.FC = () => (
  <div className="night-sky flex min-h-dvh flex-col items-center justify-center px-4 text-center">
    <OwlMark className="h-20 w-20 opacity-80" />
    <h1 className="mt-6 text-4xl font-extrabold text-fg">Nothing here but moonlight</h1>
    <p className="mt-2 max-w-md text-sm text-muted">The page you're looking for doesn't exist or has flown away.</p>
    <Link to="/dashboard" className="mt-6 inline-flex h-11 items-center rounded-xl bg-lime px-5 text-sm font-bold text-lime-ink shadow-glow">
      Back to dashboard
    </Link>
  </div>
);
