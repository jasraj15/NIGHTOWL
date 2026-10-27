import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, toSelfUser } from '../models/User.js';
import { Pool } from '../models/Pool.js';
import { Notification } from '../models/Notification.js';
import {
  registerSchema,
  verifyOtpSchema,
  requestLoginOtpSchema,
  resendOtpSchema,
  updateProfileSchema,
  selectHostelSchema,
  updatePreferencesSchema,
  deactivateAccountSchema,
} from '../validators/authSchemas.js';
import { createAndSendOtp, verifyOtp } from '../services/emailService.js';
import { COOKIE_NAME } from '../middlewares/auth.js';

const SESSION_DAYS = 7;

function cookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    // Cross-site (Vercel frontend ↔ Render backend) needs SameSite=None + Secure in production.
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
}

function signSession(user: { _id: any; email: string; hostel: string }): string {
  return jwt.sign({ userId: user._id.toString(), email: user.email, hostel: user.hostel }, env.JWT_SECRET, {
    expiresIn: `${SESSION_DAYS}d`,
  });
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = registerSchema.parse(req.body);
    const normalizedEmail = data.email.toLowerCase().trim();

    let user = await User.findOne({ email: normalizedEmail });

    if (user && user.isEmailVerified) {
      res.status(409).json({ success: false, error: 'An account with this college email already exists. Please log in.' });
      return;
    }

    if (!user) {
      user = await User.create({
        fullName: data.fullName,
        email: normalizedEmail,
        phoneNumber: data.phoneNumber,
        hostel: data.hostel || 'Uniworld 1',
        hostelSelected: Boolean(data.hostel),
        roomNumber: data.roomNumber,
        isEmailVerified: false,
      });
    } else {
      user.fullName = data.fullName;
      user.phoneNumber = data.phoneNumber;
      if (data.hostel) {
        user.hostel = data.hostel;
        user.hostelSelected = true;
      }
      user.roomNumber = data.roomNumber;
      await user.save();
    }

    const otpResult = await createAndSendOtp(normalizedEmail, 'register');

    res.status(200).json({
      success: true,
      message: otpResult.message,
      email: normalizedEmail,
      resendAfter: otpResult.resendAfter,
      debugOtp: otpResult.debugOtp,
    });
  } catch (err) {
    next(err);
  }
}

export async function requestLoginOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = requestLoginOtpSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      res.status(404).json({ success: false, error: 'No account found with this email. Please register first.' });
      return;
    }
    if (user.status === 'deactivated') {
      res.status(403).json({ success: false, error: 'This account has been deactivated.' });
      return;
    }

    const otpResult = await createAndSendOtp(normalizedEmail, 'login');
    res.status(200).json({
      success: true,
      message: otpResult.message,
      email: normalizedEmail,
      resendAfter: otpResult.resendAfter,
      debugOtp: otpResult.debugOtp,
    });
  } catch (err) {
    next(err);
  }
}

export async function resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, purpose } = resendOtpSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      res.status(404).json({ success: false, error: 'No account found with this email.' });
      return;
    }
    const otpResult = await createAndSendOtp(normalizedEmail, purpose);
    res.status(200).json({ success: true, message: otpResult.message, resendAfter: otpResult.resendAfter, debugOtp: otpResult.debugOtp });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtpHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, otp, purpose } = verifyOtpSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      res.status(404).json({ success: false, error: 'User account not found.' });
      return;
    }
    if (user.status === 'deactivated') {
      res.status(403).json({ success: false, error: 'This account has been deactivated.' });
      return;
    }

    const verification = await verifyOtp(normalizedEmail, purpose, otp);
    if (!verification.valid) {
      res.status(400).json({ success: false, error: verification.message || 'Verification failed.' });
      return;
    }

    user.isEmailVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    const token = signSession(user);
    setAuthCookie(res, token);

    res.status(200).json({
      success: true,
      message: purpose === 'register' ? 'Email verified. Welcome to NightOwl!' : 'Logged in.',
      user: toSelfUser(user),
      nextStep: user.hostelSelected ? 'dashboard' : 'select-hostel',
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    const unreadNotifications = await Notification.countDocuments({ recipient: user._id, read: false });
    res.status(200).json({ success: true, user: toSelfUser(user), unreadNotifications });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateProfileSchema.parse(req.body);
    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    if (data.fullName) user.fullName = data.fullName;
    if (data.phoneNumber) user.phoneNumber = data.phoneNumber;
    if (data.hostel) {
      user.hostel = data.hostel;
      user.hostelSelected = true;
    }
    if (data.roomNumber !== undefined) user.roomNumber = data.roomNumber;
    await user.save();
    res.status(200).json({ success: true, message: 'Profile updated.', user: toSelfUser(user) });
  } catch (err) {
    next(err);
  }
}

/** Dedicated onboarding step: persist the chosen hostel. */
export async function selectHostel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { hostel } = selectHostelSchema.parse(req.body);
    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    user.hostel = hostel;
    user.hostelSelected = true;
    await user.save();
    res.status(200).json({ success: true, message: `Hostel set to ${hostel}.`, user: toSelfUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updatePreferencesSchema.parse(req.body);
    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    if (data.theme) user.preferences.theme = data.theme;
    if (data.showPhoneToPoolMembers !== undefined) user.preferences.showPhoneToPoolMembers = data.showPhoneToPoolMembers;
    if (data.notifications) {
      user.preferences.notifications = { ...user.preferences.notifications, ...data.notifications } as any;
    }
    user.markModified('preferences');
    await user.save();
    res.status(200).json({ success: true, message: 'Preferences saved.', user: toSelfUser(user) });
  } catch (err) {
    next(err);
  }
}

/** Personal stats from real persisted data (no fabricated savings). */
export async function getMyStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!._id;
    const [created, joined, completed, active, lockedPools] = await Promise.all([
      Pool.countDocuments({ creator: userId }),
      Pool.countDocuments({ participants: userId, creator: { $ne: userId } }),
      Pool.countDocuments({ participants: userId, status: 'DELIVERED' }),
      Pool.countDocuments({ participants: userId, status: { $in: ['OPEN', 'LOCKED', 'ORDERED'] } }),
      Pool.find({ creator: userId, lockedAt: { $exists: true } }).select('createdAt lockedAt deliveryFee participants').lean(),
    ]);

    const fillTimes = lockedPools
      .filter((p: any) => p.lockedAt && p.createdAt)
      .map((p: any) => (new Date(p.lockedAt).getTime() - new Date(p.createdAt).getTime()) / 60000);
    const avgMinutesToLock = fillTimes.length ? Math.round(fillTimes.reduce((a, b) => a + b, 0) / fillTimes.length) : null;

    const totalPools = created + joined;
    const participationRate = totalPools > 0 ? Math.round((completed / totalPools) * 100) : null;

    res.status(200).json({
      success: true,
      stats: {
        poolsCreated: created,
        poolsJoined: joined,
        poolsCompleted: completed,
        activePools: active,
        participationRatePercent: participationRate,
        avgMinutesToLock,
        note: 'All figures are computed from your persisted pools. Fee-sharing savings are not estimated.',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Soft-delete: financial records and order history are retained for other participants,
 * personal data is minimised and the session is revoked.
 */
export async function deactivateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { confirmEmail } = deactivateAccountSchema.parse(req.body);
    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    if (confirmEmail.toLowerCase() !== user.email) {
      res.status(400).json({ success: false, error: 'Email confirmation does not match your account.' });
      return;
    }
    const activeAsHost = await Pool.countDocuments({ creator: user._id, status: { $in: ['OPEN', 'LOCKED', 'ORDERED'] } });
    if (activeAsHost > 0) {
      res.status(400).json({ success: false, error: 'Cancel or complete the pools you are hosting before deactivating.' });
      return;
    }

    // Remove the user from any open pools they joined so totals stay accurate.
    const openJoined = await Pool.find({ participants: user._id, creator: { $ne: user._id }, status: 'OPEN' });
    for (const pool of openJoined) {
      pool.participants = pool.participants.filter((p) => p.toString() !== user._id.toString());
      await pool.save();
    }

    user.status = 'deactivated';
    user.deactivatedAt = new Date();
    user.phoneNumber = '9000000000';
    user.roomNumber = undefined;
    user.fullName = 'Deactivated Student';
    await user.save();

    res.clearCookie(COOKIE_NAME, cookieOptions());
    res.status(200).json({ success: true, message: 'Your account has been deactivated. Order history is retained for other participants.' });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
}
