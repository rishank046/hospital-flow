import type { ElementType, ReactNode } from 'react';
import { Info, CheckCircle, AlertTriangle, AlertCircle, X } from 'lucide-react';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  type?: AlertType;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  onRetry?: () => void;
  className?: string;
}

const iconMap: Record<AlertType, ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
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
  const IconComponent = iconMap[type];

  return (
    <div className={`alert-banner alert-${type} ${className}`} role={role}>
      <div className="alert-icon" aria-hidden="true">
        <IconComponent size={18} aria-hidden="true" />
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
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
