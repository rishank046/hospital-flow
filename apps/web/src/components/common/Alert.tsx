import type { ReactNode } from 'react';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  type?: AlertType;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  onRetry?: () => void;
  className?: string;
}

const iconMap: Record<AlertType, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕',
};

export function Alert({
  type = 'info',
  title,
  children,
  onClose,
  onRetry,
  className = '',
}: AlertProps) {
  const role = type === 'error' ? 'alert' : 'status';

  return (
    <div className={`alert-banner alert-${type} ${className}`} role={role}>
      <div className="alert-icon" aria-hidden="true">
        {iconMap[type]}
      </div>
      <div className="alert-body">
        {title && <h4 className="alert-title">{title}</h4>}
        <div className="alert-message">{children}</div>
        {onRetry && (
          <button
            type="button"
            className="alert-retry-btn"
            onClick={onRetry}
          >
            Try again
          </button>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          className="alert-close-btn"
          onClick={onClose}
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      )}
    </div>
  );
}
