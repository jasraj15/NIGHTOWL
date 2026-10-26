import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import {
  registerSchema,
  verifyOtpSchema,
  requestLoginOtpSchema,
  updateProfileSchema,
} from '../validators/authSchemas.js';
import { createAndSendOtp, verifyOtp } from '../services/emailService.js';

const COOKIE_NAME = 'nightowl_token';

function setAuthCookie(res: Response, token: string): void {
  const isProd = env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = registerSchema.parse(req.body);
    const normalizedEmail = data.email.toLowerCase().trim();

    let user = await User.findOne({ email: normalizedEmail });

    if (user && user.isEmailVerified) {
      res.status(409).json({
        success: false,
        error: 'An account with this SST college email already exists. Please log in.',
      });
      return;
    }

    if (!user) {
      user = await User.create({
        fullName: data.fullName,
        email: normalizedEmail,
        phoneNumber: data.phoneNumber,
        hostel: data.hostel,
        roomNumber: data.roomNumber,
        isEmailVerified: false,
      });
    } else {
      // Update details for unverified account
      user.fullName = data.fullName;
      user.phoneNumber = data.phoneNumber;
      user.hostel = data.hostel;
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
      res.status(404).json({
        success: false,
        error: 'No account found with this email. Please register first.',
      });
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
    const { email, purpose } = req.body;
    if (!email || !purpose) {
      res.status(400).json({ success: false, error: 'Email and purpose are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otpResult = await createAndSendOtp(normalizedEmail, purpose);

    res.status(200).json({
      success: true,
      message: otpResult.message,
      resendAfter: otpResult.resendAfter,
      debugOtp: otpResult.debugOtp,
    });
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

    const verification = await verifyOtp(normalizedEmail, purpose, otp);
    if (!verification.valid) {
      res.status(400).json({
        success: false,
        error: verification.message || 'Verification failed.',
      });
      return;
    }

    // Mark email verified
    user.isEmailVerified = true;
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        hostel: user.hostel,
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    setAuthCookie(res, token);

    res.status(200).json({
      success: true,
      message: 'Email successfully verified. Welcome to NightOwl!',
      token,
      user: {
        _id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        hostel: user.hostel,
        roomNumber: user.roomNumber,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    success: true,
    user: req.user,
  });
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateProfileSchema.parse(req.body);
    const userId = req.user!._id;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    if (data.fullName) user.fullName = data.fullName;
    if (data.phoneNumber) user.phoneNumber = data.phoneNumber;
    if (data.hostel) user.hostel = data.hostel;
    if (data.roomNumber !== undefined) user.roomNumber = data.roomNumber;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        _id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        hostel: user.hostel,
        roomNumber: user.roomNumber,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie(COOKIE_NAME, {
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
}
