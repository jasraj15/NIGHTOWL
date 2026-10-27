import React from 'react';
import { Link } from 'react-router-dom';
import { cx } from '../../utils/format.js';

export const OwlMark: React.FC<{ className?: string }> = ({ className }) => (
  <img src="/owl-icon.svg" alt="" aria-hidden className={cx('block', className)} />
);

export const Logo: React.FC<{ to?: string; compact?: boolean; className?: string }> = ({ to = '/', compact, className }) => (
  <Link to={to} className={cx('group inline-flex items-center gap-2.5', className)} aria-label="NightOwl home">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-gradient-to-br from-overlay to-canvas p-1.5 transition-colors group-hover:border-lime/40">
      <OwlMark className="h-full w-full" />
    </span>
    {!compact && (
      <span className="leading-tight">
        <span className="block text-lg font-extrabold tracking-tight text-fg">NightOwl</span>
        <span className="hidden text-[11px] font-medium text-faint sm:block">Your midnight cravings, together</span>
      </span>
    )}
  </Link>
);

/** Illustrations for the two hostels — original, abstract tower silhouettes under a moon. */
export const HostelArt: React.FC<{ hostel: 'Uniworld 1' | 'Uniworld 2'; className?: string }> = ({ hostel, className }) => {
  const one = hostel === 'Uniworld 1';
  return (
    <svg viewBox="0 0 240 140" className={cx('h-auto w-full', className)} role="img" aria-label={`${hostel} illustration`}>
      <defs>
        <linearGradient id={`sky-${one ? 1 : 2}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={one ? '#1A2542' : '#231A42'} />
          <stop offset="100%" stopColor="#0B0F19" />
        </linearGradient>
      </defs>
      <rect width="240" height="140" rx="16" fill={`url(#sky-${one ? 1 : 2})`} />
      {/* stars */}
      {[20, 60, 95, 150, 200, 225].map((x, i) => (
        <circle key={x} cx={x} cy={18 + ((i * 13) % 30)} r={i % 2 ? 1.2 : 0.8} fill="#F7F4EB" opacity="0.7" />
      ))}
      {/* moon */}
      {one ? (
        <circle cx="196" cy="34" r="16" fill="#CCFF00" opacity="0.9" />
      ) : (
        <path d="M 200 18 A 16 16 0 1 0 200 50 A 12 12 0 1 1 200 18 Z" fill="#CCFF00" opacity="0.9" />
      )}
      {/* towers */}
      {one ? (
        <g>
          <rect x="40" y="52" width="46" height="78" rx="4" fill="#141D33" stroke="#324578" strokeWidth="2" />
          <rect x="100" y="36" width="56" height="94" rx="4" fill="#141D33" stroke="#324578" strokeWidth="2" />
          <rect x="170" y="64" width="40" height="66" rx="4" fill="#141D33" stroke="#324578" strokeWidth="2" />
        </g>
      ) : (
        <g>
          <rect x="30" y="44" width="60" height="86" rx="4" fill="#141D33" stroke="#324578" strokeWidth="2" />
          <rect x="104" y="60" width="44" height="70" rx="4" fill="#141D33" stroke="#324578" strokeWidth="2" />
          <rect x="160" y="40" width="50" height="90" rx="4" fill="#141D33" stroke="#324578" strokeWidth="2" />
        </g>
      )}
      {/* lit windows */}
      {Array.from({ length: 18 }).map((_, i) => {
        const col = i % 6;
        const row = Math.floor(i / 6);
        const x = (one ? 48 : 38) + col * 28 + (col > 1 ? 10 : 0) + (col > 3 ? 12 : 0);
        const y = 70 + row * 18;
        const lit = (i * 7 + (one ? 3 : 5)) % 4 !== 0;
        return <rect key={i} x={x} y={y} width="8" height="10" rx="1.5" fill={lit ? '#CCFF00' : '#223055'} opacity={lit ? 0.85 : 1} />;
      })}
      <rect x="0" y="128" width="240" height="12" fill="#060911" />
    </svg>
  );
};
