import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, HostelType, UserRole, UserPreferences } from '../models/User.js';

export interface AuthenticatedUser {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  hostel: HostelType;
  hostelSelected: boolean;
  roomNumber?: string;
  isEmailVerified: boolean;
  role: UserRole;
  preferences: UserPreferences;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const COOKIE_NAME = 'nightowl_token';

export function extractToken(req: Request): string | undefined {
  let token = req.cookies?.[COOKIE_NAME];
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  return token;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      res.status(401).json({ success: false, error: 'User account not found or session has expired.' });
      return;
    }
    if (user.status === 'deactivated') {
      res.status(401).json({ success: false, error: 'This account has been deactivated.' });
      return;
    }

    req.user = {
      _id: (user._id as any).toString(),
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      hostel: user.hostel,
      hostelSelected: Boolean(user.hostelSelected),
      roomNumber: user.roomNumber,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
      preferences: user.preferences as UserPreferences,
    };

    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired session. Please log in again.' });
  }
}

export function requireVerifiedCollegeEmail(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }
  if (!req.user.isEmailVerified) {
    res.status(403).json({
      success: false,
      error: 'Access restricted: please verify your college email address via OTP first.',
      code: 'EMAIL_NOT_VERIFIED',
    });
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'You do not have permission to access this resource.' });
      return;
    }
    next();
  };
}
