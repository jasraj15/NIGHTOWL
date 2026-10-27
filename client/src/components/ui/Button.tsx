import React from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../../utils/format.js';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  block?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-lime text-lime-ink hover:bg-lime-soft shadow-glow font-bold',
  secondary: 'bg-overlay text-fg hover:bg-line-strong/40 border border-line font-semibold',
  outline: 'bg-transparent text-fg border border-line-strong hover:bg-overlay font-semibold',
  ghost: 'bg-transparent text-muted hover:text-fg hover:bg-overlay font-semibold',
  danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 font-semibold',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, iconRight, block, className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center whitespace-nowrap transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
);
Button.displayName = 'Button';
