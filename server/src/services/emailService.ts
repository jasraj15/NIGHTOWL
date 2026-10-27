import crypto from 'crypto';
import { Resend } from 'resend';
import { env } from '../config/env.js';
import { OtpToken, OtpPurpose } from '../models/OtpToken.js';

let resendClient: Resend | null = null;
if (env.RESEND_API_KEY) {
  resendClient = new Resend(env.RESEND_API_KEY);
}

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export function generate6DigitOtp(): string {
  // 6 digits: 100000 to 999999
  const buffer = crypto.randomBytes(4);
  const num = buffer.readUInt32BE(0) % 900000 + 100000;
  return num.toString();
}

export async function createAndSendOtp(
  email: string,
  purpose: OtpPurpose
): Promise<{ success: boolean; resendAfter: Date; message: string; debugOtp?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check for existing valid token with cooldown
  const existing = await OtpToken.findOne({ email: normalizedEmail, purpose });
  const now = new Date();

  if (existing && existing.resendAfter > now) {
    const waitSeconds = Math.ceil((existing.resendAfter.getTime() - now.getTime()) / 1000);
    throw new Error(`Please wait ${waitSeconds}s before requesting a new verification code.`);
  }

  // Remove any previous active tokens for this email & purpose
  await OtpToken.deleteMany({ email: normalizedEmail, purpose });

  const rawOtp = generate6DigitOtp();
  const otpHash = hashOtp(rawOtp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const resendAfter = new Date(Date.now() + 60 * 1000); // 60 seconds cooldown

  await OtpToken.create({
    email: normalizedEmail,
    otpHash,
    purpose,
    attempts: 0,
    expiresAt,
    resendAfter,
  });

  let sentViaResend = false;

  if (resendClient && env.RESEND_API_KEY) {
    try {
      const emailTitle = purpose === 'register' ? 'Verify your NightOwl account' : 'Your NightOwl login code';
      await resendClient.emails.send({
        from: env.EMAIL_FROM,
        to: normalizedEmail,
        subject: `[NightOwl] ${rawOtp} is your verification code`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #FBF7EE; color: #111111; padding: 32px; border-radius: 16px; border: 1px solid #E5DCC8;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #111111; font-size: 26px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">NightOwl 🦉</h1>
              <p style="color: #6B6048; margin-top: 6px; font-size: 14px;">Your midnight cravings, together.</p>
            </div>
            <div style="background: #F9D97A; border-radius: 12px; padding: 24px; text-align: center;">
              <p style="margin: 0 0 12px; font-size: 15px; color: #111111;">${emailTitle}</p>
              <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #111111; margin: 16px 0; font-family: monospace;">
                ${rawOtp}
              </div>
              <p style="font-size: 13px; color: #4A4028; margin: 0;">This single-use code expires in 10 minutes. Never share this code with anyone.</p>
            </div>
            <p style="font-size: 12px; color: #8A7A50; text-align: center; margin-top: 24px;">
              Designed for SST students at Uniworld 1 & Uniworld 2.
            </p>
          </div>
        `,
      });
      sentViaResend = true;
    } catch (err) {
      console.error('⚠️ Resend email sending failed:', err);
    }
  }

  // Development/test only: surface the code so the flow can be exercised without an email provider.
  // In production the OTP is never logged or returned unless OTP_FALLBACK_DISPLAY=true (evaluation deployments
  // without a verified email domain) — and even then only when no email could be sent.
  let debugOtp: string | undefined = undefined;
  const showFallback = env.NODE_ENV !== 'production' || env.OTP_FALLBACK_DISPLAY;
  if (showFallback && !sentViaResend) {
    console.log(`\n========================================`);
    console.log(`🦉 [NightOwl OTP DEV Fallback]`);
    console.log(`To: ${normalizedEmail}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`Code: ${rawOtp}`);
    console.log(`Expires: ${expiresAt.toISOString()}`);
    console.log(`========================================\n`);
    debugOtp = rawOtp;
  }

  return {
    success: true,
    resendAfter,
    message: sentViaResend
      ? `Verification code sent to ${normalizedEmail}`
      : env.NODE_ENV === 'production' && !env.OTP_FALLBACK_DISPLAY
      ? 'We could not send the email right now. Please try again in a minute.'
      : env.NODE_ENV === 'production'
      ? 'Email delivery is not configured on this deployment — use the code shown below.'
      : 'Verification code generated (development mode: see server console).',
    debugOtp,
  };
}

export async function verifyOtp(
  email: string,
  purpose: OtpPurpose,
  candidateOtp: string
): Promise<{ valid: boolean; message?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const tokenDoc = await OtpToken.findOne({ email: normalizedEmail, purpose });

  if (!tokenDoc) {
    return { valid: false, message: 'No active verification code found. Please request a new one.' };
  }

  // Check expiration
  if (new Date() > tokenDoc.expiresAt) {
    await OtpToken.deleteOne({ _id: tokenDoc._id });
    return { valid: false, message: 'Verification code has expired. Please request a new code.' };
  }

  // Check attempt limit
  if (tokenDoc.attempts >= 5) {
    await OtpToken.deleteOne({ _id: tokenDoc._id });
    return { valid: false, message: 'Too many incorrect attempts. Please request a new verification code.' };
  }

  const hashedCandidate = hashOtp(candidateOtp.trim());

  if (hashedCandidate !== tokenDoc.otpHash) {
    tokenDoc.attempts += 1;
    if (tokenDoc.attempts >= 5) {
      await OtpToken.deleteOne({ _id: tokenDoc._id });
      return {
        valid: false,
        message: 'Too many incorrect attempts. Please request a new verification code.',
      };
    }
    await tokenDoc.save();
    const remaining = 5 - tokenDoc.attempts;
    return {
      valid: false,
      message: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
    };
  }

  // Successful verification -> delete token to ensure single-use
  await OtpToken.deleteOne({ _id: tokenDoc._id });
  return { valid: true };
}
