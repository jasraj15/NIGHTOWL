import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t border-navy-800 bg-navy-950/60 py-12 text-sm text-ivory-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-navy-800 border border-navy-700 flex items-center justify-center p-1">
              <img src="/owl-icon.svg" alt="NightOwl Logo" className="w-full h-full" />
            </div>
            <div>
              <p className="font-bold text-ivory-200">NightOwl — Hostel Group Ordering</p>
              <p className="text-xs text-ivory-500">
                Built for Uniworld 1 & Uniworld 2 campus hostel residents.
              </p>
            </div>
          </div>

          <div className="text-center md:text-right text-xs space-y-1">
            <p className="text-ivory-400">
              Disclaimer: NightOwl coordinates orders between hostel peers; it does not claim to place retailer orders automatically.
            </p>
            <p className="text-ivory-500">
              Zero platform markup. Proportional cost splitting. Never store banking credentials.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
