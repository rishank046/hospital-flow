import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightElement,
  id,
  className = '',
  ...rest
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`form-field ${error ? 'has-error' : ''}`}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
        </label>
      )}

      <div className="input-wrap">
        {leftIcon && <span className="input-icon" aria-hidden="true">{leftIcon}</span>}
        <input
          id={inputId}
          className={`form-input ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error && inputId ? `${inputId}-error` : undefined}
          {...rest}
        />
        {rightElement && <div className="input-right-element">{rightElement}</div>}
      </div>

      {error && (
        <p id={inputId ? `${inputId}-error` : undefined} className="field-error-text" role="alert">
          {error}
        </p>
      )}

      {!error && helperText && (
        <p className="field-helper-text">{helperText}</p>
      )}
    </div>
  );
}
