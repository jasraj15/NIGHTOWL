import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Mail, Phone, User as UserIcon, ArrowRight, ShieldCheck, RefreshCw, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { errorMessage } from '../services/api.js';
import { Button } from '../components/ui/Button.js';
import { Input, Checkbox } from '../components/ui/Field.js';
import { Alert } from '../components/ui/Bits.js';
import { OwlMark } from '../components/brand/Logo.js';

const COLLEGE_EMAIL = /^[a-zA-Z0-9._%+-]+@sst\.scaler\.com$/;
const INDIAN_PHONE = /^[6-9]\d{9}$/;

type Mode = 'register' | 'login';
type Step = 'form' | 'otp';

export const AuthPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const toast = useToast();
  const { register, requestLoginOtp, resendOtp, verifyOtp } = useAuth();

  const mode: Mode = params.get('mode') === 'login' ? 'login' : 'register';
  const setMode = (m: Mode) => {
    setParams({ mode: m }, { replace: true });
    setErrors({});
    setServerError(null);
  };

  const [step, setStep] = useState<Step>('form');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [debugOtp, setDebugOtp] = useState<string | undefined>();
  const [info, setInfo] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!COLLEGE_EMAIL.test(email.trim())) e.email = 'Use your @sst.scaler.com college email';
    if (mode === 'register') {
      if (fullName.trim().length < 2) e.fullName = 'Enter your full name';
      if (!INDIAN_PHONE.test(phone)) e.phone = 'Enter a valid 10-digit Indian mobile number';
      if (!agreed) e.agreed = 'Please accept the community rules and privacy policy';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const cooldownFrom = (resendAfter?: number | string) => {
    if (typeof resendAfter === 'number') return resendAfter;
    if (resendAfter) return Math.max(5, Math.round((new Date(resendAfter).getTime() - Date.now()) / 1000));
    return 60;
  };

  const afterOtpSent = (res: { message: string; debugOtp?: string; resendAfter?: number | string }) => {
    setInfo(res.message);
    setDebugOtp(res.debugOtp);
    setCooldown(cooldownFrom(res.resendAfter));
    setOtp('');
    setStep('otp');
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const res =
        mode === 'register'
          ? await register({ fullName: fullName.trim(), email: email.trim().toLowerCase(), phoneNumber: phone, agreedToRules: true })
          : await requestLoginOtp(email.trim().toLowerCase());
      afterOtpSent(res);
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setErrors({ otp: 'Enter the 6-digit code' });
      return;
    }
    setErrors({});
    setServerError(null);
    setLoading(true);
    try {
      const { nextStep } = await verifyOtp(email.trim().toLowerCase(), otp, mode);
      toast.success(mode === 'register' ? 'Email verified — welcome to NightOwl!' : 'Welcome back!');
      if (nextStep === 'select-hostel') navigate('/select-hostel', { replace: true });
      else navigate(location.state?.from && location.state.from !== '/auth' ? location.state.from : '/dashboard', { replace: true });
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setServerError(null);
    try {
      const res = await resendOtp(email.trim().toLowerCase(), mode);
      setInfo(res.message);
      setDebugOtp(res.debugOtp);
      setCooldown(cooldownFrom(res.resendAfter));
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  return (
    <div className="night-sky flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="text-center">
          <Link to="/" className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-raised p-2.5 shadow-card" aria-label="NightOwl home">
            <OwlMark className="h-full w-full" />
          </Link>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-fg">
            {step === 'otp' ? 'Check your inbox' : mode === 'register' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {step === 'otp' ? (
              <>
                We sent a 6-digit code to <span className="font-semibold text-fg">{email}</span>
              </>
            ) : (
              'Passwordless sign-in for verified SST students.'
            )}
          </p>
        </div>

        <div className="card mt-8 p-6 sm:p-8">
          {step === 'form' && (
            <div role="tablist" className="mb-6 grid grid-cols-2 rounded-xl border border-line bg-surface p-1">
              {(['register', 'login'] as Mode[]).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg py-2 text-xs font-bold transition-colors ${mode === m ? 'bg-overlay text-lime' : 'text-muted hover:text-fg'}`}
                >
                  {m === 'register' ? 'Create account' : 'Log in'}
                </button>
              ))}
            </div>
          )}

          {serverError && (
            <Alert kind="danger" className="mb-4">
              {serverError}
            </Alert>
          )}
          {info && step === 'otp' && (
            <Alert kind="success" className="mb-4">
              {info}
            </Alert>
          )}
          {debugOtp && step === 'otp' && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-lime/40 bg-base px-4 py-3 text-xs">
              <span className="font-semibold text-muted">Dev mode — code printed by the server:</span>
              <button type="button" onClick={() => setOtp(debugOtp)} className="font-mono text-base font-extrabold text-lime hover:underline">
                {debugOtp}
              </button>
            </div>
          )}

          {step === 'form' ? (
            <form onSubmit={submitForm} className="space-y-4" noValidate>
              {mode === 'register' && (
                <Input
                  label="Full name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Asha Verma"
                  autoComplete="name"
                  leading={<UserIcon className="h-4 w-4" />}
                  error={errors.fullName}
                />
              )}
              <Input
                label="College email"
                required
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@sst.scaler.com"
                leading={<Mail className="h-4 w-4" />}
                error={errors.email}
                hint={mode === 'register' ? 'Only @sst.scaler.com addresses can join. We verify it with a one-time code.' : undefined}
                className="font-mono"
              />
              {mode === 'register' && (
                <>
                  <Input
                    label="Indian mobile number"
                    required
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    leading={<Phone className="h-4 w-4" />}
                    error={errors.phone}
                    hint="Shared with pool hosts only if you choose to. Phone ownership is not verified."
                    className="font-mono"
                  />
                  <Checkbox
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    error={errors.agreed}
                    label={
                      <>
                        I agree to the{' '}
                        <Link to="/legal#rules" className="font-semibold text-lime hover:underline">
                          community rules
                        </Link>{' '}
                        and{' '}
                        <Link to="/legal#privacy" className="font-semibold text-lime hover:underline">
                          privacy policy
                        </Link>
                        .
                      </>
                    }
                  />
                </>
              )}
              <Button type="submit" block size="lg" loading={loading} iconRight={<ArrowRight className="h-4 w-4" />}>
                {mode === 'register' ? 'Send verification code' : 'Send login code'}
              </Button>
              <p className="text-center text-xs text-faint">
                {mode === 'register' ? 'Already verified?' : 'New here?'}{' '}
                <button type="button" onClick={() => setMode(mode === 'register' ? 'login' : 'register')} className="font-semibold text-lime hover:underline">
                  {mode === 'register' ? 'Log in instead' : 'Create an account'}
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={submitOtp} className="space-y-5" noValidate>
              <Input
                autoFocus
                label="6-digit verification code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                error={errors.otp}
                hint="The code expires in 10 minutes and works once."
                className="text-center font-mono text-2xl font-extrabold tracking-[0.5em]"
              />
              <Button type="submit" block size="lg" loading={loading} disabled={otp.length !== 6} icon={<ShieldCheck className="h-4 w-4" />}>
                Verify & continue
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => setStep('form')} className="inline-flex items-center gap-1 text-muted hover:text-fg">
                  <ArrowLeft className="h-3.5 w-3.5" /> Change email
                </button>
                <button
                  type="button"
                  onClick={() => void resend()}
                  disabled={cooldown > 0}
                  className="inline-flex items-center gap-1 font-semibold text-lime disabled:cursor-not-allowed disabled:text-faint"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-faint">
          By continuing you agree to the{' '}
          <Link to="/legal" className="underline hover:text-fg">
            terms
          </Link>
          ,{' '}
          <Link to="/legal#privacy" className="underline hover:text-fg">
            privacy policy
          </Link>{' '}
          and{' '}
          <Link to="/legal#rules" className="underline hover:text-fg">
            community rules
          </Link>
          .
        </p>
      </div>
    </div>
  );
};
