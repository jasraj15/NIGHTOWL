import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, IUser } from '../models/User.js';

export interface AuthenticatedUser {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  hostel: 'Uniworld 1' | 'Uniworld 2';
  roomNumber?: string;
  isEmailVerified: boolean;
  role: 'student' | 'moderator';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token = req.cookies?.['nightowl_token'];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in.',
      });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };

    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User account not found or session has expired.',
      });
      return;
    }

    req.user = {
      _id: (user._id as any).toString(),
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      hostel: user.hostel,
      roomNumber: user.roomNumber,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
    };

    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired session. Please log in again.',
    });
  }
}

export function requireVerifiedCollegeEmail(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }

  if (!req.user.isEmailVerified) {
    res.status(403).json({
      success: false,
      error: 'Access restricted: Please verify your college email address via OTP first.',
    });
    return;
  }

  next();
}
