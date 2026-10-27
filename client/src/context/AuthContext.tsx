import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { HostelType, User, UserPreferences } from '../types/index.js';
import { get, post, patch, del } from '../services/api.js';
import { connectSocket, disconnectSocket } from '../services/socket.js';
import { useTheme } from './ThemeContext.js';

export interface RegisterPayload {
  fullName: string;
  email: string;
  phoneNumber: string;
  agreedToRules: true;
}

interface OtpResponse {
  success: boolean;
  message: string;
  email?: string;
  resendAfter?: number | string;
  debugOtp?: string;
}

interface AuthApi {
  user: User | null;
  /** True while the session is being restored on first load. */
  initializing: boolean;
  unreadNotifications: number;
  setUnreadNotifications: React.Dispatch<React.SetStateAction<number>>;
  register: (payload: RegisterPayload) => Promise<OtpResponse>;
  requestLoginOtp: (email: string) => Promise<OtpResponse>;
  resendOtp: (email: string, purpose: 'register' | 'login') => Promise<OtpResponse>;
  verifyOtp: (email: string, otp: string, purpose: 'register' | 'login') => Promise<{ user: User; nextStep: 'dashboard' | 'select-hostel' }>;
  selectHostel: (hostel: HostelType) => Promise<User>;
  updateProfile: (data: { fullName?: string; phoneNumber?: string; hostel?: HostelType; roomNumber?: string }) => Promise<User>;
  updatePreferences: (data: Partial<Omit<UserPreferences, 'notifications'>> & { notifications?: Partial<UserPreferences['notifications']> }) => Promise<User>;
  deactivateAccount: (confirmEmail: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { setTheme } = useTheme();

  const adopt = useCallback(
    (u: User) => {
      setUser(u);
      if (u.preferences?.theme) setTheme(u.preferences.theme);
      connectSocket();
    },
    [setTheme]
  );

  const refreshUser = useCallback(async () => {
    const res = await get<{ user: User; unreadNotifications: number }>('/auth/me');
    adopt(res.user);
    setUnreadNotifications(res.unreadNotifications || 0);
  }, [adopt]);

  // Restore the session from the HttpOnly cookie on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await get<{ user: User; unreadNotifications: number }>('/auth/me');
        if (!cancelled) {
          adopt(res.user);
          setUnreadNotifications(res.unreadNotifications || 0);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adopt]);

  const api = useMemo<AuthApi>(
    () => ({
      user,
      initializing,
      unreadNotifications,
      setUnreadNotifications,
      register: (payload) => post<OtpResponse>('/auth/register', payload),
      requestLoginOtp: (email) => post<OtpResponse>('/auth/login-request', { email }),
      resendOtp: (email, purpose) => post<OtpResponse>('/auth/resend-otp', { email, purpose }),
      verifyOtp: async (email, otp, purpose) => {
        const res = await post<{ user: User; nextStep: 'dashboard' | 'select-hostel' }>('/auth/verify-otp', { email, otp, purpose });
        adopt(res.user);
        return { user: res.user, nextStep: res.nextStep };
      },
      selectHostel: async (hostel) => {
        const res = await post<{ user: User }>('/users/me/hostel', { hostel });
        setUser(res.user);
        return res.user;
      },
      updateProfile: async (data) => {
        const res = await patch<{ user: User }>('/users/me', data);
        setUser(res.user);
        return res.user;
      },
      updatePreferences: async (data) => {
        const res = await patch<{ user: User }>('/users/me/preferences', data);
        setUser(res.user);
        if (data.theme) setTheme(data.theme);
        return res.user;
      },
      deactivateAccount: async (confirmEmail) => {
        await del('/users/me', { confirmEmail });
        setUser(null);
        disconnectSocket();
      },
      refreshUser,
      logout: async () => {
        try {
          await post('/auth/logout');
        } finally {
          setUser(null);
          setUnreadNotifications(0);
          disconnectSocket();
        }
      },
    }),
    [user, initializing, unreadNotifications, adopt, refreshUser, setTheme]
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
