import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, LogOut, Menu, X, Clock, Compass } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

interface NavbarProps {
  onCreatePoolClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onCreatePoolClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 bg-navy-900/90 backdrop-blur-md border-b border-navy-750">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy-800 to-navy-950 border border-navy-700 flex items-center justify-center p-1.5 shadow-sm group-hover:border-lime/40 transition-colors">
              <img src="/owl-icon.svg" alt="NightOwl Icon" className="w-full h-full" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-ivory-50 flex items-center gap-1.5">
                NightOwl
                <span className="text-xs px-1.5 py-0.5 rounded bg-lime/10 text-lime border border-lime/30 font-semibold tracking-wide">
                  HOSTEL
                </span>
              </span>
              <p className="hidden sm:block text-[11px] text-ivory-400 -mt-1 font-medium">
                Your midnight cravings, together
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-sm font-medium text-ivory-300 hover:text-lime transition-colors"
            >
              <Compass className="w-4 h-4" />
              Discover Pools
            </Link>

            {user && (
              <Link
                to="/history"
                className="flex items-center gap-1.5 text-sm font-medium text-ivory-300 hover:text-lime transition-colors"
              >
                <Clock className="w-4 h-4" />
                My Orders
              </Link>
            )}

            {/* Live Socket Sync Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-navy-800 border border-navy-700 text-[11px] text-ivory-400">
              <span className="w-2 h-2 rounded-full bg-lime animate-pulse"></span>
              Live Sync
            </div>
          </nav>

          {/* Right Action buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={onCreatePoolClick || (() => navigate('/dashboard?create=true'))}
                  className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl bg-lime text-navy-950 hover:bg-lime-400 shadow-glow-lime transition-all"
                >
                  <PlusCircle className="w-4 h-4" />
                  Create Pool
                </button>

                <div className="h-6 w-px bg-navy-750" />

                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-navy-800 border border-navy-700 text-sm font-medium text-ivory-200 hover:border-navy-600 transition-colors"
                  title={`${user.fullName} (${user.hostel})`}
                >
                  <div className="w-6 h-6 rounded-full bg-navy-700 flex items-center justify-center text-xs font-bold text-lime">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[120px] truncate">{user.fullName.split(' ')[0]}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-900 text-ivory-400 font-mono">
                    {user.hostel === 'Uniworld 1' ? 'U1' : 'U2'}
                  </span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="p-2 text-ivory-400 hover:text-rose-400 rounded-xl hover:bg-navy-800 transition-colors"
                  title="Log out"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/auth?mode=login"
                  className="px-4 py-2 text-sm font-medium text-ivory-200 hover:text-ivory-50 rounded-xl hover:bg-navy-800 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-lime text-navy-950 hover:bg-lime-400 shadow-glow-lime transition-all"
                >
                  Join NightOwl
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            {user && (
              <button
                onClick={onCreatePoolClick || (() => navigate('/dashboard?create=true'))}
                className="p-2 rounded-lg bg-lime text-navy-950 text-xs font-bold"
                aria-label="Create Pool"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-ivory-300 hover:text-ivory-100 rounded-lg bg-navy-800"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-navy-750 bg-navy-900/95 px-4 pt-3 pb-6 space-y-3">
          <Link
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-base font-medium text-ivory-200 hover:text-lime"
          >
            Discover Pools
          </Link>
          {user ? (
            <>
              <Link
                to="/history"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-base font-medium text-ivory-200 hover:text-lime"
              >
                My Orders & History
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-base font-medium text-ivory-200 hover:text-lime"
              >
                Profile ({user.hostel})
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left py-2 text-base font-medium text-rose-400"
              >
                Log Out
              </button>
            </>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/auth?mode=login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 text-center text-sm font-semibold rounded-xl bg-navy-800 text-ivory-100 border border-navy-700"
              >
                Log in
              </Link>
              <Link
                to="/auth?mode=register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 text-center text-sm font-bold rounded-xl bg-lime text-navy-950"
              >
                Verify College Email
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
