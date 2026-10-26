import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, Phone, Building2, User as UserIcon, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { HostelType } from '../types/index.js';

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, register, requestLoginOtp, verifyOtp, resendOtp } = useAuth();

  const [mode, setMode] = useState<'register' | 'login'>(
    searchParams.get('mode') === 'login' ? 'login' : 'register'
  );

  // Registration Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hostel, setHostel] = useState<HostelType>('Uniworld 1');
  const [roomNumber, setRoomNumber] = useState('');

  // OTP State
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [debugOtp, setDebugOtp] = useState<string | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Cooldown timer countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        hostel,
        roomNumber: roomNumber.trim() || undefined,
      });

      setInfoMessage(res.message);
      if (res.debugOtp) setDebugOtp(res.debugOtp);
      setCooldown(60);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await requestLoginOtp(email.trim());
      setInfoMessage(res.message);
      if (res.debugOtp) setDebugOtp(res.debugOtp);
      setCooldown(60);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Login request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await verifyOtp(email.trim(), otp.trim(), mode);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    try {
      const res = await resendOtp(email.trim(), mode);
      setInfoMessage(res.message);
      if (res.debugOtp) setDebugOtp(res.debugOtp);
      setCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    }
  };

  // Quick fill helper for demo accounts
  const handleQuickFillDemo = (demoEmail: string, demoName: string, demoHostel: HostelType) => {
    setEmail(demoEmail);
    setFullName(demoName);
    setPhoneNumber('9876543210');
    setHostel(demoHostel);
    setRoomNumber('A-302');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* Header Icon & Brand */}
        <div className="text-center">
          <Link to="/" className="inline-block">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-navy-850 border border-navy-750 flex items-center justify-center p-2.5 shadow-xl shadow-navy-950">
              <img src="/owl-icon.svg" alt="NightOwl" className="w-full h-full" />
            </div>
          </Link>

          <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold text-ivory-50">
            {step === 'otp'
              ? 'Verify College Email'
              : mode === 'register'
              ? 'Join NightOwl'
              : 'Welcome back, Student'}
          </h2>

          <p className="mt-1 text-sm text-ivory-400">
            {step === 'otp'
              ? `We sent a single-use 6-digit code to ${email}`
              : 'Late-night group shopping for SST campus hostels.'}
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-navy-850 border border-navy-750 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 p-3 rounded-xl bg-lime/10 border border-lime/30 text-lime text-xs">
              {infoMessage}
            </div>
          )}

          {/* Dev Debug Code Hint */}
          {debugOtp && (
            <div className="mb-4 p-3 rounded-xl bg-navy-900 border border-lime/40 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ivory-300 font-semibold">Dev Verification Code:</span>
                <span className="font-mono text-base font-extrabold text-lime">{debugOtp}</span>
              </div>
              <button
                type="button"
                onClick={() => setOtp(debugOtp)}
                className="mt-1 text-[11px] text-lime hover:underline"
              >
                Click to autofill code
              </button>
            </div>
          )}

          {step === 'form' ? (
            <>
              {/* Tab Selector */}
              <div className="flex rounded-xl bg-navy-900 p-1 mb-6 border border-navy-750">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    mode === 'register'
                      ? 'bg-navy-800 text-lime shadow-sm'
                      : 'text-ivory-400 hover:text-ivory-200'
                  }`}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    mode === 'login'
                      ? 'bg-navy-800 text-lime shadow-sm'
                      : 'text-ivory-400 hover:text-ivory-200'
                  }`}
                >
                  Passwordless Log in
                </button>
              </div>

              {/* Form Body */}
              {mode === 'register' ? (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-ivory-300 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-ivory-500" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none"
                      />
                    </div>
                  </div>

                  {/* College Email */}
                  <div>
                    <label className="block text-xs font-semibold text-ivory-300 mb-1">
                      Scaler College Email (@sst.scaler.com)
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-ivory-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yourname@sst.scaler.com"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Phone & Hostel */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ivory-300 mb-1">
                        Indian Phone (10 digits)
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 w-4 h-4 text-ivory-500" />
                        <input
                          type="tel"
                          required
                          pattern="[6-9][0-9]{9}"
                          maxLength={10}
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                          placeholder="9876543210"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ivory-300 mb-1">
                        Hostel
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3 w-4 h-4 text-ivory-500" />
                        <select
                          value={hostel}
                          onChange={(e) => setHostel(e.target.value as HostelType)}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none"
                        >
                          <option value="Uniworld 1">Uniworld 1</option>
                          <option value="Uniworld 2">Uniworld 2</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Room Number */}
                  <div>
                    <label className="block text-xs font-semibold text-ivory-400 mb-1">
                      Room / Wing Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="e.g. Tower A - Room 402"
                      className="w-full px-3.5 py-2 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-lime text-navy-950 font-bold text-sm hover:bg-lime-400 shadow-glow-lime transition-all disabled:opacity-50"
                  >
                    {loading ? 'Sending Code...' : 'Get Verification OTP'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                /* Passwordless Login Form */
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-ivory-300 mb-1">
                      Enter your Registered College Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-ivory-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yourname@sst.scaler.com"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-lime text-navy-950 font-bold text-sm hover:bg-lime-400 shadow-glow-lime transition-all disabled:opacity-50"
                  >
                    {loading ? 'Sending Code...' : 'Send Login Code'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Demo Account Quick-Fill */}
              <div className="mt-6 pt-4 border-t border-navy-750">
                <span className="text-[11px] text-ivory-400 font-semibold uppercase tracking-wider block mb-2">
                  Dev Quick-Fill Demo Profiles:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickFillDemo('arjun.demo@sst.scaler.com', 'Arjun Mehta', 'Uniworld 1')
                    }
                    className="p-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-left border border-navy-750 text-ivory-300"
                  >
                    <span className="font-semibold text-ivory-100 block">Arjun M.</span>
                    Uniworld 1 (Host)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickFillDemo('rohit.demo@sst.scaler.com', 'Rohit Verma', 'Uniworld 2')
                    }
                    className="p-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-left border border-navy-750 text-ivory-300"
                  >
                    <span className="font-semibold text-ivory-100 block">Rohit V.</span>
                    Uniworld 2 (Host)
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* OTP Step */
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-ivory-300 mb-2 text-center">
                  Enter 6-Digit Single-Use Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-full text-center tracking-[12px] text-2xl font-extrabold font-mono py-3 rounded-xl bg-navy-900 border-2 border-navy-700 text-lime focus:border-lime outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-lime text-navy-950 font-bold text-sm hover:bg-lime-400 shadow-glow-lime transition-all disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {loading ? 'Verifying...' : 'Verify & Enter NightOwl'}
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="text-ivory-400 hover:text-ivory-200"
                >
                  ← Edit Email
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  className={`flex items-center gap-1 font-semibold ${
                    cooldown > 0 ? 'text-ivory-500 cursor-not-allowed' : 'text-lime hover:underline'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
