import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';

export function DoctorLoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    setLoading(true);
    try {
      const response = await authService.doctorLogin({
        email: email.trim(),
        password,
      });

      login(response.token, 'DOCTOR', {
        id: response.doctor?.id,
        name: response.doctor?.name,
        email: response.doctor?.email || email.trim(),
        role: 'DOCTOR',
        specialization: response.doctor?.specialization,
        department: response.doctor?.department,
      });

      window.history.pushState({}, '', '/doctor');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Doctor sign-in failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="form-panel standalone-form-panel">
        <div className="form-container">
          <div className="mobile-brand">MediQ Clinical</div>

          <div className="form-heading">
            <p className="form-kicker">PHYSICIAN & STAFF PORTAL</p>
            <h2>Doctor sign-in</h2>
            <p>Access clinical schedules, patient charts, and treatment plans.</p>
          </div>

          {error && <Alert type="error" className="mb-4">{error}</Alert>}

          <form onSubmit={handleSubmit} noValidate>
            <Input
              label="Doctor Hospital Email"
              type="email"
              placeholder="doctor@hospital.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your physician password"
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
              Sign In to Doctor Portal
            </Button>
          </form>

          <div className="admin-note mt-4">
            <span>i</span>
            Doctor credentials are provisioned by hospital administration.
          </div>

          <div className="form-actions mt-2">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                window.history.pushState({}, '', '/login');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            >
              ← Back to Patient Sign-in
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
