import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Compass, PlusCircle, ClipboardList, Settings, LogOut, Wifi, WifiOff, Bell } from 'lucide-react';
import { Logo } from '../components/brand/Logo.js';
import { NotificationBell } from '../components/notifications/NotificationBell.js';
import { useAuth } from '../context/AuthContext.js';
import { Avatar } from '../components/ui/Bits.js';
import { getSocket } from '../services/socket.js';
import { cx } from '../utils/format.js';

const navItems = [
  { to: '/dashboard', label: 'Discover', icon: Compass },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/pools/new', label: 'Create', icon: PlusCircle, primary: true },
  { to: '/notifications', label: 'Alerts', icon: Bell, mobileOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function useSocketStatus() {
  const [online, setOnline] = useState<boolean>(() => Boolean(getSocket()?.connected));
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    setOnline(s.connected);
    s.on('connect', on);
    s.on('disconnect', off);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
    };
  });
  return online;
}

export const AppLayout: React.FC = () => {
  const { user, logout, unreadNotifications } = useAuth();
  const navigate = useNavigate();
  const online = useSocketStatus();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Logo to="/dashboard" />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {navItems
              .filter((n) => !n.mobileOnly && !n.primary)
              .map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cx('inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors', isActive ? 'bg-overlay text-fg' : 'text-muted hover:text-fg')
                  }
                >
                  <Icon className="h-4 w-4" /> {label}
                </NavLink>
              ))}
          </nav>

          <div className="flex items-center gap-2">
            <span
              className={cx('hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:inline-flex', online ? 'border-lime/30 text-lime' : 'border-line text-faint')}
              title={online ? 'Live updates connected' : 'Reconnecting…'}
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? 'Live' : 'Offline'}
            </span>
            <Link to="/pools/new" className="hidden h-10 items-center gap-2 rounded-xl bg-lime px-3.5 text-sm font-bold text-lime-ink shadow-glow hover:bg-lime-soft md:inline-flex">
              <PlusCircle className="h-4 w-4" /> Create pool
            </Link>
            <NotificationBell />
            {user && (
              <Link to="/settings" className="hidden items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pl-1.5 pr-3 md:flex" title={`${user.fullName} · ${user.hostel}`}>
                <Avatar name={user.fullName} size="sm" />
                <span className="max-w-[110px] truncate text-sm font-semibold text-fg">{user.fullName.split(' ')[0]}</span>
                <span className="rounded bg-overlay px-1.5 py-0.5 font-mono text-[10px] text-muted">{user.hostel === 'Uniworld 1' ? 'U1' : 'U2'}</span>
              </Link>
            )}
            <button onClick={() => void handleLogout()} className="hidden rounded-xl p-2 text-faint hover:bg-overlay hover:text-danger md:block" aria-label="Log out" title="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-10">
        <Outlet />
      </main>

      <footer className="hidden border-t border-line py-6 text-center text-xs text-faint md:block">
        NightOwl is an independent coordination tool for hostel students. It does not place orders with retailers or access their carts.
        <span className="mx-2">·</span>
        <Link to="/legal" className="hover:text-fg">
          Terms, privacy & community rules
        </Link>
      </footer>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden" aria-label="Mobile">
        <div className="grid grid-cols-5">
          {navItems.map(({ to, label, icon: Icon, primary }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cx('relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold', isActive ? 'text-lime' : 'text-faint', primary && 'text-lime')
              }
            >
              {primary ? (
                <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-lime text-lime-ink shadow-glow">
                  <Icon className="h-6 w-6" />
                </span>
              ) : (
                <Icon className="h-5 w-5" />
              )}
              {to === '/notifications' && unreadNotifications > 0 && (
                <span className="absolute right-4 top-1.5 h-2 w-2 rounded-full bg-lime" aria-hidden />
              )}
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
