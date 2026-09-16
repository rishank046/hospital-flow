interface LoadingScreenProps {
  message?: string;
  supportingText?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({
  message = 'Loading MediQ workspace...',
  supportingText = 'Verifying clinical session & workspace credentials',
  fullScreen = true,
}: LoadingScreenProps) {
  return (
    <div
      className={fullScreen ? 'global-loading-screen' : 'inline-loading-screen'}
      role="status"
      aria-live="polite"
    >
      <div className="loading-card">
        <div className="loading-brand">
          <div className="brand-mark loading-brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="brand-name">MediQ</span>
        </div>

        <div className="loading-indicator">
          <div className="loading-spinner-ring" aria-hidden="true" />
        </div>

        <h3 className="loading-primary-text">{message}</h3>
        {supportingText && (
          <p className="loading-supporting-text">{supportingText}</p>
        )}
      </div>
    </div>
  );
}
