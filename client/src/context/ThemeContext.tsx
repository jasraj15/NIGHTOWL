import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ThemePreference } from '../types/index.js';

const STORAGE_KEY = 'nightowl-theme';

interface ThemeApi {
  theme: ThemePreference;
  resolved: 'dark' | 'light';
  setTheme: (t: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

function resolve(t: ThemePreference): 'dark' | 'light' {
  if (t === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return t;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(readStored);
  const [resolved, setResolved] = useState<'dark' | 'light'>(() => resolve(readStored()));

  const apply = useCallback((t: ThemePreference) => {
    const r = resolve(t);
    setResolved(r);
    document.documentElement.classList.toggle('dark', r === 'dark');
    document.documentElement.classList.toggle('light', r === 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', r === 'dark' ? '#14120F' : '#F3D88A');
  }, []);

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, apply]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, apply]);

  const value = useMemo<ThemeApi>(() => ({ theme, resolved, setTheme: setThemeState }), [theme, resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
