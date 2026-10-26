import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="w-5 h-5 text-lime" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400" />,
    info: <Info className="w-5 h-5 text-sky-400" />,
  };

  const borderColors: Record<ToastType, string> = {
    success: 'border-lime/40 bg-navy-850',
    error: 'border-rose-500/40 bg-navy-850',
    info: 'border-sky-500/40 bg-navy-850',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full px-4 animate-bounce-short">
      <div
        className={`flex items-center gap-3 p-4 rounded-xl border shadow-xl ${borderColors[toast.type]}`}
        role="alert"
      >
        <div className="flex-shrink-0">{icons[toast.type]}</div>
        <p className="flex-1 text-sm font-medium text-ivory-100">{toast.message}</p>
        <button
          onClick={onDismiss}
          className="p-1 text-ivory-400 hover:text-ivory-100 rounded transition-colors"
          aria-label="Dismiss toast"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
