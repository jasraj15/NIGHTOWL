import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cx } from '../../utils/format.js';
import { Button } from './Button.js';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Prevent closing by backdrop / escape (e.g. while a payment is in flight). */
  locked?: boolean;
}

const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, description, children, footer, size = 'md', locked }) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
      if (e.key === 'Tab' && panelRef.current) {
        // simple focus trap
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
      first?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, locked]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => !locked && onClose()} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-raised shadow-2xl animate-fade-up sm:rounded-2xl',
          sizes[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-fg">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {!locked && (
            <button data-close onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-faint hover:bg-overlay hover:text-fg" aria-label="Close dialog">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
      </div>
    </div>
  );
};

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmProps> = ({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', danger, loading }) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => void onConfirm()} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="text-sm text-muted">{description}</div>
  </Modal>
);
