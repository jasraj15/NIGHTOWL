import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, HostelType } from '../types/index.js';
import { apiFetch } from '../services/api.js';
import { disconnectSocket, getSocket } from '../services/socket.js';

interface RegisterPayload {
  fullName: string;
  email: string;
  phoneNumber: string;
  hostel: HostelType;
  roomNumber?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; message: string; debugOtp?: string }>;
  verifyOtp: (email: string, otp: string, purpose: 'register' | 'login') => Promise<void>;
  requestLoginOtp: (email: string) => Promise<{ success: boolean; message: string; debugOtp?: string }>;
  resendOtp: (email: string, purpose: 'register' | 'login') => Promise<{ success: boolean; message: string; debugOtp?: string }>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session from HttpOnly cookie on initial mount
  useEffect(() => {
    async function restoreSession() {
      try {
        const res = await apiFetch<{ success: boolean; user: User }>('/api/auth/me');
        if (res.success && res.user) {
          setUser(res.user);
          getSocket();
        }
      } catch (err) {
        // Session not present or expired
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  const clearError = () => setError(null);

  const register = async (payload: RegisterPayload) => {
    setError(null);
    try {
      const res = await apiFetch<{
        success: boolean;
        message: string;
        email: string;
        debugOtp?: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res;
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  const requestLoginOtp = async (email: string) => {
    setError(null);
    try {
      const res = await apiFetch<{
        success: boolean;
        message: string;
        email: string;
        debugOtp?: string;
      }>('/api/auth/login-request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return res;
    } catch (err: any) {
      setError(err.message || 'Login request failed');
      throw err;
    }
  };

  const resendOtp = async (email: string, purpose: 'register' | 'login') => {
    setError(null);
    try {
      const res = await apiFetch<{
        success: boolean;
        message: string;
        debugOtp?: string;
      }>('/api/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email, purpose }),
      });
      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code');
      throw err;
    }
  };

  const verifyOtp = async (email: string, otp: string, purpose: 'register' | 'login') => {
    setError(null);
    try {
      const res = await apiFetch<{
        success: boolean;
        token: string;
        user: User;
      }>('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp, purpose }),
      });

      setUser(res.user);
      setToken(res.token);
      getSocket(res.token);
    } catch (err: any) {
      setError(err.message || 'OTP verification failed');
      throw err;
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      const res = await apiFetch<{ success: boolean; user: User }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      setUser(res.user);
    } catch (err: any) {
      setError(err.message || 'Profile update failed');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      // Continue client cleanup even if network fails
    } finally {
      setUser(null);
      setToken(null);
      disconnectSocket();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        register,
        verifyOtp,
        requestLoginOtp,
        resendOtp,
        updateProfile,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
