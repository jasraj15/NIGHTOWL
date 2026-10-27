import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { errorMessage } from '../services/api.js';
import { HostelType, HOSTELS } from '../types/index.js';
import { HostelArt, OwlMark } from '../components/brand/Logo.js';
import { Button } from '../components/ui/Button.js';
import { cx } from '../utils/format.js';

const copy: Record<HostelType, { blurb: string; detail: string }> = {
  'Uniworld 1': { blurb: 'The original tower block.', detail: 'Pools here usually meet at the main lobby or tower reception.' },
  'Uniworld 2': { blurb: 'The newer wing across the road.', detail: 'Separate delivery address — orders are not shared with Uniworld 1.' },
};

export const SelectHostelPage: React.FC = () => {
  const { user, selectHostel } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [selected, setSelected] = useState<HostelType | null>(user?.hostelSelected ? user.hostel : null);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await selectHostel(selected);
      toast.success(`You're set up for ${selected}`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error('Could not save your hostel', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="night-sky flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
        <div className="text-center">
          <OwlMark className="mx-auto h-14 w-14" />
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-lime">Step 2 of 2</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-fg">Where do you live, {user?.fullName.split(' ')[0]}?</h1>
          <p className="mt-2 text-sm text-muted">
            Your hostel decides which pools you see first. Each pool still asks you to confirm its delivery spot before you join — the two hostels have different addresses.
          </p>
        </div>

        <div role="radiogroup" aria-label="Choose your hostel" className="mt-8 grid gap-4 sm:grid-cols-2">
          {HOSTELS.map((h) => {
            const active = selected === h;
            return (
              <button
                key={h}
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(h)}
                className={cx(
                  'card group relative overflow-hidden border-transparent p-4 text-left transition-all hover:-translate-y-0.5',
                  h === 'Uniworld 1' ? 'bg-sky' : 'bg-blush',
                  active && 'border-lime ring-2 ring-lime/40'
                )}
              >
                <HostelArt hostel={h} className="rounded-xl" />
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-fg">{h}</h2>
                    <p className="mt-0.5 text-sm text-muted">{copy[h].blurb}</p>
                    <p className="mt-1 text-xs text-faint">{copy[h].detail}</p>
                  </div>
                  <span
                    className={cx(
                      'mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors',
                      active ? 'border-lime bg-lime text-lime-ink' : 'border-line-strong text-transparent group-hover:border-lime/50'
                    )}
                    aria-hidden
                  >
                    <Check className="h-4 w-4" />
                  </span>
                </div>
                <span className={cx('mt-4 block rounded-xl py-2.5 text-center text-sm font-bold', active ? 'bg-lime text-lime-ink' : 'bg-overlay text-fg')}>
                  {active ? 'Selected' : `Select ${h}`}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <Button size="lg" disabled={!selected} loading={saving} onClick={() => void confirm()} iconRight={<ArrowRight className="h-5 w-5" />}>
            Continue to dashboard
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-faint">You can change your default hostel any time in Settings.</p>
      </div>
    </div>
  );
};
