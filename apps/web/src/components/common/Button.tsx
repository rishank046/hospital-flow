import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled,
  icon,
  className = '',
  ...rest
}: ButtonProps) {
  const variantClass = `btn-${variant}`;
  const classes = ['btn', variantClass, className].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="btn-loading-content">
          <span className="btn-spinner" aria-hidden="true" />
          <span>Loading...</span>
        </span>
      ) : (
        <span className="btn-content">
          {icon && <span className="btn-icon">{icon}</span>}
          <span>{children}</span>
        </span>
      )}
    </button>
  );
}
