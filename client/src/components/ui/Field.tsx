import React, { useId } from 'react';
import { cx } from '../../utils/format.js';

interface FieldWrapProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
}

const FieldWrap: React.FC<FieldWrapProps> = ({ label, hint, error, required, className, children }) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = error ? errId : hint ? hintId : undefined;
  return (
    <div className={cx('w-full', className)}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {children(id, describedBy)}
      {error ? (
        <p id={errId} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  wrapClassName?: string;
}

export const Input: React.FC<InputProps> = ({ label, hint, error, leading, trailing, wrapClassName, className, required, ...rest }) => (
  <FieldWrap label={label} hint={hint} error={error} required={required} className={wrapClassName}>
    {(id, describedBy) => (
      <div className="relative">
        {leading && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-faint">{leading}</span>}
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          required={required}
          className={cx('input', leading ? 'pl-10' : undefined, trailing ? 'pr-10' : undefined, error ? 'border-danger focus:border-danger' : undefined, className)}
          {...rest}
        />
        {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
      </div>
    )}
  </FieldWrap>
);

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapClassName?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, hint, error, wrapClassName, className, required, ...rest }) => (
  <FieldWrap label={label} hint={hint} error={error} required={required} className={wrapClassName}>
    {(id, describedBy) => (
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        required={required}
        className={cx('input min-h-[88px] resize-y', error && 'border-danger', className)}
        {...rest}
      />
    )}
  </FieldWrap>
);

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapClassName?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select: React.FC<SelectProps> = ({ label, hint, error, wrapClassName, className, options, required, ...rest }) => (
  <FieldWrap label={label} hint={hint} error={error} required={required} className={wrapClassName}>
    {(id, describedBy) => (
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        required={required}
        className={cx('input appearance-none bg-no-repeat pr-9', error && 'border-danger', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394886E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundPosition: 'right 0.75rem center',
        }}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )}
  </FieldWrap>
);

export const Checkbox: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; error?: string }> = ({ label, error, className, ...rest }) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={cx('flex cursor-pointer items-start gap-3 text-sm text-muted', className)}>
        <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong bg-surface accent-[rgb(var(--c-lime))]" {...rest} />
        <span>{label}</span>
      </label>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }> = ({
  checked,
  onChange,
  label,
  description,
  disabled,
}) => (
  <div className="flex items-start justify-between gap-4 py-3">
    <div className="min-w-0">
      <p className="text-sm font-semibold text-fg">{label}</p>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50',
        checked ? 'border-lime bg-lime' : 'border-line-strong bg-overlay'
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 h-[18px] w-[18px] rounded-full shadow transition-transform',
          checked ? 'left-0.5 translate-x-5 bg-lime-ink' : 'left-0.5 translate-x-0 bg-fg'
        )}
      />
    </button>
  </div>
);
