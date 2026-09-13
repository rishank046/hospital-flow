export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export function Spinner({
  size = 'md',
  label = 'Loading...',
  className = '',
}: SpinnerProps) {
  return (
    <div
      className={`spinner-container spinner-${size} ${className}`}
      role="status"
      aria-label={label}
    >
      <div className="spinner-circle" aria-hidden="true" />
      {label && <span className="spinner-text">{label}</span>}
    </div>
  );
}
