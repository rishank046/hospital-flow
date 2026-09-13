import { Button } from '../components/common/Button';

export function NotFoundPage() {
  const goHome = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <main className="not-found-shell">
      <div className="not-found-card">
        <div className="not-found-badge">404</div>
        <h1>Page Not Found</h1>
        <p>The clinical page or route you requested does not exist or has moved.</p>
        <Button variant="primary" onClick={goHome}>
          Return to MediQ Home
        </Button>
      </div>
    </main>
  );
}
