import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { User as UserIcon, Bell, ShieldCheck, Wallet, Palette, LogOut, CheckCircle2, AlertTriangle, Moon, Sun, Monitor } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { get, errorMessage } from '../services/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { HOSTELS, HostelType, MyStats, NotificationPreferences, PaymentConfig, PaymentRecord, ThemePreference } from '../types/index.js';
import { Button } from '../components/ui/Button.js';
import { Input, Select, Toggle } from '../components/ui/Field.js';
import { Alert, PageHeader, PaymentBadge, Skeleton, Stat } from '../components/ui/Bits.js';
import { Modal } from '../components/ui/Modal.js';
import { money, formatDateTime, cx } from '../utils/format.js';

type Section = 'profile' | 'notifications' | 'privacy' | 'payments' | 'appearance';
const SECTIONS: { value: Section; label: string; icon: React.ElementType }[] = [
  { value: 'profile', label: 'Profile', icon: UserIcon },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'privacy', label: 'Privacy & security', icon: ShieldCheck },
  { value: 'payments', label: 'Payments', icon: Wallet },
  { value: 'appearance', label: 'Appearance', icon: Palette },
];

const NOTIF_LABELS: Record<keyof NotificationPreferences, { label: string; description: string }> = {
  poolInvitations: { label: 'Pool invitations', description: 'When someone invites you to a pool.' },
  someoneJoinsMyPool: { label: 'Someone joins my pool', description: 'As host, each time a student joins.' },
  poolNearlyFull: { label: 'Pool is nearly full', description: 'When a pool you are in is one spot from its limit.' },
  deadlineApproaching: { label: 'Deadline approaching', description: 'Shortly before a pool you are in closes, and when it is extended.' },
  paymentUpdates: { label: 'Payment status updates', description: 'Verified, failed or refunded payments.' },
  orderUpdates: { label: 'Order status updates', description: 'Locked, ordered, delivered or cancelled.' },
};

export const SettingsPage: React.FC = () => {
  const { section = 'profile' } = useParams<{ section?: Section }>();
  const navigate = useNavigate();
  const active = (SECTIONS.some((s) => s.value === section) ? section : 'profile') as Section;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Account" title="Settings" />
      <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto md:flex-col">
          {SECTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => navigate(`/settings/${value}`)}
              aria-current={active === value ? 'page' : undefined}
              className={cx(
                'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                active === value ? 'bg-overlay text-fg' : 'text-muted hover:text-fg'
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {active === 'profile' && <ProfileSection />}
          {active === 'notifications' && <NotificationsSection />}
          {active === 'privacy' && <PrivacySection />}
          {active === 'payments' && <PaymentsSection />}
          {active === 'appearance' && <AppearanceSection />}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------- Profile ------------------------------- */

const ProfileSection: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [hostel, setHostel] = useState<HostelType>(user?.hostel || 'Uniworld 1');
  const [room, setRoom] = useState(user?.roomNumber || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const stats = useAsync(() => get<{ stats: MyStats }>('/users/me/stats'), []);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setPhone(user.phoneNumber);
    setHostel(user.hostel);
    setRoom(user.roomNumber || '');
  }, [user]);

  const dirty = user && (fullName !== user.fullName || phone !== user.phoneNumber || hostel !== user.hostel || room !== (user.roomNumber || ''));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (fullName.trim().length < 2) er.fullName = 'Enter your name';
    if (!/^[6-9]\d{9}$/.test(phone)) er.phone = 'Enter a valid 10-digit Indian mobile number';
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      await updateProfile({ fullName: fullName.trim(), phoneNumber: phone, hostel, roomNumber: room.trim() });
      toast.success('Profile saved');
    } catch (err) {
      toast.error('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  return (
    <div className="space-y-5">
      <form onSubmit={save} className="card space-y-4 p-5 sm:p-6" noValidate>
        <h2 className="font-bold text-fg">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} autoComplete="name" />
          <Input label="College email" value={user.email} readOnly className="font-mono" hint={undefined} trailing={<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-lime"><CheckCircle2 className="h-3.5 w-3.5" /> verified</span>} />
          <Input label="Phone number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" error={errors.phone} hint="Not verified. Hidden from other students unless you allow it below in Privacy." className="font-mono" />
          <Input label="Room / wing (optional)" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={20} placeholder="Tower A · 304" />
          <Select label="Default hostel" value={hostel} onChange={(e) => setHostel(e.target.value as HostelType)} options={HOSTELS.map((h) => ({ value: h, label: h }))} hint="Used for discovery defaults. Each pool still asks you to confirm its delivery location." />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>

      <section className="card p-5 sm:p-6">
        <h2 className="font-bold text-fg">Your activity</h2>
        <p className="mt-0.5 text-xs text-faint">Computed from your persisted pools — no estimates.</p>
        {stats.loading ? (
          <Skeleton className="mt-4 h-24" />
        ) : stats.data ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Created" value={stats.data.stats.poolsCreated} />
            <Stat label="Joined" value={stats.data.stats.poolsJoined} />
            <Stat label="Completed" value={stats.data.stats.poolsCompleted} hint={stats.data.stats.participationRatePercent != null ? `${stats.data.stats.participationRatePercent}% completion` : undefined} />
            <Stat label="Avg. time to lock" value={stats.data.stats.avgMinutesToLock != null ? `${stats.data.stats.avgMinutesToLock}m` : '—'} hint="pools you hosted" />
          </div>
        ) : null}
      </section>
    </div>
  );
};

/* ---------------------------- Notifications ---------------------------- */

const NotificationsSection: React.FC = () => {
  const { user, updatePreferences } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  if (!user) return null;
  const prefs = user.preferences.notifications;

  const toggle = async (key: keyof NotificationPreferences, value: boolean) => {
    setSaving(key);
    try {
      await updatePreferences({ notifications: { [key]: value } });
    } catch (err) {
      toast.error('Could not save', errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-bold text-fg">Notifications</h2>
      <p className="mt-0.5 text-xs text-faint">In-app notifications are delivered live and stored in your inbox. Turned-off types are not created at all.</p>
      <div className="mt-3 divide-y divide-line">
        {(Object.keys(NOTIF_LABELS) as (keyof NotificationPreferences)[]).map((k) => (
          <Toggle key={k} label={NOTIF_LABELS[k].label} description={NOTIF_LABELS[k].description} checked={prefs[k] !== false} onChange={(v) => void toggle(k, v)} disabled={saving === k} />
        ))}
      </div>
    </section>
  );
};

/* -------------------------------- Privacy -------------------------------- */

const PrivacySection: React.FC = () => {
  const { user, updatePreferences, deactivateAccount, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const togglePhone = async (v: boolean) => {
    setSaving(true);
    try {
      await updatePreferences({ showPhoneToPoolMembers: v });
    } catch (err) {
      toast.error('Could not save', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setDeactivating(true);
    setError(null);
    try {
      await deactivateAccount(confirmEmail.trim().toLowerCase());
      toast.info('Account deactivated', 'Your order history stays available to other participants.');
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="card p-5 sm:p-6">
        <h2 className="font-bold text-fg">Privacy</h2>
        <div className="mt-2 divide-y divide-line">
          <Toggle
            label="Show my phone number to pool members"
            description="Only members of pools you host can see it, for coordinating delivery. Off by default."
            checked={user.preferences.showPhoneToPoolMembers}
            onChange={(v) => void togglePhone(v)}
            disabled={saving}
          />
        </div>
        <p className="mt-2 text-xs text-faint">Payment references and transaction IDs are only ever visible to you and the host of that pool.</p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-bold text-fg">Security & sessions</h2>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>• Sign-in is passwordless: a one-time code is emailed to your college address each time, so there is no password to change or reset.</li>
          <li>• Your session is an HttpOnly cookie valid for 7 days. Logging out clears it on this device.</li>
          <li>• Email verified: <span className="font-semibold text-lime">yes</span> · Member since {formatDateTime(user.createdAt)}</li>
        </ul>
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            icon={<LogOut className="h-4 w-4" />}
          >
            Log out of this device
          </Button>
        </div>
      </section>

      <section className="card border-danger/30 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold text-danger">
          <AlertTriangle className="h-4 w-4" /> Deactivate account
        </h2>
        <p className="mt-1 text-sm text-muted">
          Your name and phone are anonymised and you are removed from open pools. Order and payment records are kept so other participants' history stays accurate. You must cancel or complete any pool you host first.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setDeactivateOpen(true)}>
          Deactivate my account
        </Button>
      </section>

      <Modal
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        title="Deactivate your account?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeactivateOpen(false)} disabled={deactivating}>
              Keep my account
            </Button>
            <Button variant="danger" onClick={() => void deactivate()} loading={deactivating} disabled={confirmEmail.trim().toLowerCase() !== user.email}>
              Deactivate
            </Button>
          </>
        }
      >
        {error && (
          <Alert kind="danger" className="mb-4">
            {error}
          </Alert>
        )}
        <p className="text-sm text-muted">
          Type <span className="font-mono text-fg">{user.email}</span> to confirm.
        </p>
        <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} className="mt-3 font-mono" placeholder={user.email} aria-label="Confirm email" />
      </Modal>
    </div>
  );
};

/* -------------------------------- Payments -------------------------------- */

const PaymentsSection: React.FC = () => {
  const history = useAsync(
    () =>
      get<{ records: Array<Omit<PaymentRecord, 'poolId' | 'userId'> & { pool: { _id: string; title: string; retailer: string; status: string } | null }>; summary: { totalDue: number; totalPaid: number } }>(
        '/payments/history'
      ),
    []
  );
  const config = useAsync(() => get<{ config: PaymentConfig }>('/payments/config'), []);
  const { user } = useAuth();

  return (
    <div className="space-y-5">
      <section className="card p-5 sm:p-6">
        <h2 className="font-bold text-fg">Payment settings</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Online payments</dt>
            <dd className="font-semibold text-fg">
              {config.data?.config.provider === 'razorpay' ? `Razorpay${config.data.config.testMode ? ' (test mode)' : ''}` : 'Not configured on this server — manual UPI references only'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Payout account for pools you host</dt>
            <dd className="font-semibold text-fg">{user?.hasLinkedPayoutAccount ? 'Linked (Razorpay Route)' : 'Not linked'}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-faint">
          NightOwl never stores card numbers, UPI PINs or bank passwords. Online payments are collected by the platform's Razorpay merchant account; paying out to a host requires Razorpay Route onboarding (see the project README).
        </p>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-fg">Payment history</h2>
          {history.data && (
            <p className="text-xs text-muted">
              Paid <span className="font-mono font-bold text-lime">{money(history.data.summary.totalPaid)}</span> of {money(history.data.summary.totalDue)} due
            </p>
          )}
        </div>
        {history.loading ? (
          <Skeleton className="mt-4 h-32" />
        ) : history.error ? (
          <Alert kind="danger" className="mt-4">
            {history.error}
          </Alert>
        ) : !history.data || history.data.records.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No contributions yet. Your share appears here once a host records an order.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {history.data.records.map((r) => (
              <li key={r._id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link to={r.pool ? `/pools/${r.pool._id}` : '#'} className="font-semibold text-fg hover:text-lime">
                    {r.pool?.title || 'Pool'}
                  </Link>
                  <p className="text-xs text-muted">
                    {r.pool?.retailer} · {formatDateTime(r.paidAt || r.createdAt)} · {r.paymentMethod === 'RAZORPAY' ? 'Razorpay' : r.paymentMethod === 'MANUAL_UPI' ? 'Manual UPI' : 'No method yet'}
                  </p>
                  {(r.razorpayPaymentId || r.paymentReference) && <p className="font-mono text-[11px] text-faint">{r.razorpayPaymentId || `UTR ${r.paymentReference}`}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-fg">{money(r.totalDue)}</span>
                  <PaymentBadge status={r.paymentStatus} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

/* ------------------------------- Appearance ------------------------------- */

const AppearanceSection: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { user, updatePreferences } = useAuth();
  const toast = useToast();

  const choose = async (t: ThemePreference) => {
    setTheme(t);
    if (user) {
      try {
        await updatePreferences({ theme: t });
      } catch (err) {
        toast.error('Saved on this device only', errorMessage(err));
      }
    }
  };

  const options: { value: ThemePreference; label: string; icon: React.ElementType; blurb: string }[] = [
    { value: 'light', label: 'Day', icon: Sun, blurb: 'Butter yellow, white cards, black type.' },
    { value: 'dark', label: 'Night', icon: Moon, blurb: 'Midnight navy and lime — easy on the eyes at 1 am.' },
    { value: 'system', label: 'System', icon: Monitor, blurb: 'Follow your device setting.' },
  ];

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-bold text-fg">Appearance</h2>
      <p className="mt-0.5 text-xs text-faint">Saved to your profile and applied on every device you sign in to.</p>
      <div role="radiogroup" aria-label="Theme" className="mt-4 grid gap-3 sm:grid-cols-3">
        {options.map(({ value, label, icon: Icon, blurb }) => (
          <button
            key={value}
            role="radio"
            aria-checked={theme === value}
            onClick={() => void choose(value)}
            className={cx('rounded-2xl border p-4 text-left transition-colors', theme === value ? 'border-lime bg-lime/5' : 'border-line bg-surface hover:border-line-strong')}
          >
            <Icon className={cx('h-5 w-5', theme === value ? 'text-lime' : 'text-muted')} />
            <p className="mt-2 font-semibold text-fg">{label}</p>
            <p className="text-xs text-muted">{blurb}</p>
          </button>
        ))}
      </div>
    </section>
  );
};
