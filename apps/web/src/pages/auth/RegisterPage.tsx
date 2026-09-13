import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';

export function RegisterPage() {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.register({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      login(response.token, 'PATIENT', {
        id: response.user?.id,
        name: name.trim(),
        email: email.trim(),
        role: 'PATIENT',
      });

      window.history.pushState({}, '', '/patient');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <main className="auth-shell">
      <section className="form-panel standalone-form-panel">
        <div className="form-container">
          <div className="mobile-brand">MediQ</div>

          <div className="form-heading">
            <p className="form-kicker">PATIENT REGISTRATION</p>
            <h2>Create your account</h2>
            <p>Set up your patient profile in seconds to access your clinical flow.</p>
          </div>

          {error && <Alert type="error" className="mb-4">{error}</Alert>}

          <form onSubmit={handleSubmit} noValidate>
            <Input
              label="Full Name"
              placeholder="e.g. Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password (min 6 characters)"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              rightElement={
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              }
            />

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="submit-button mt-4"
            >
              Register & Sign In
            </Button>
          </form>

          <div className="form-actions mt-4">
            <button
              type="button"
              className="text-button primary"
              onClick={goToLogin}
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
