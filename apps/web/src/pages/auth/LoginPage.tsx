import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth.service';
import { Alert } from '../../components/common/Alert';
import type { AuthUser, StaffInfo, StaffRole, UserRole } from '../../types/auth.types';

export function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('session_expired') === 'true') {
      sessionStorage.removeItem('session_expired');
      return 'Your session has expired. Please sign in again.';
    }
    return null;
  });

  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.login({
        email: email.trim(),
        password,
      });

      const token = response.data?.token || response.token;
      const user = response.data?.user || response.user;
      const staff = response.data?.staff ?? response.staff ?? null;

      if (!token || !user) {
        throw new Error('Authentication response is missing required session tokens.');
      }

      const role = (user.role || 'USER').toUpperCase() as UserRole;
      const staffRole = (staff?.staffRole || staff?.role || user.staffRole)?.toUpperCase() as StaffRole | undefined;

      const authUser: AuthUser = {
        id: user.id,
        name:
          user.name ||
          (role === 'ADMIN'
            ? 'Administrator'
            : role === 'STAFF'
            ? (staffRole === 'DOCTOR' ? 'Doctor' : 'Staff Member')
            : 'User'),
        email: user.email || email.trim(),
        role,
        staffRole,
        employeeCode: staff?.employeeCode || user.employeeCode,
        specialization: user.specialization,
        department: staff?.department || user.department,
      };

      const staffInfo: StaffInfo | null = (role === 'STAFF' && (staff || staffRole)) ? {
        id: staff?.id || '',
        staffRole: (staffRole || 'OPD_MANAGER') as StaffRole,
        role: (staffRole || 'OPD_MANAGER') as StaffRole,
        employeeCode: staff?.employeeCode,
        status: staff?.status,
        department: staff?.department,
      } : null;

      login(token, authUser, staffInfo);

      // Post-login routing strictly based on backend roles
      let targetRoute = '/user';
      if (role === 'ADMIN') {
        targetRoute = '/admin';
      } else if (role === 'USER' || role === 'PATIENT') {
        targetRoute = '/user';
      } else if (role === 'STAFF') {
        switch (staffRole) {
          case 'DOCTOR':
            targetRoute = '/staff/doctor';
            break;
          case 'OPD_MANAGER':
            targetRoute = '/staff/opd';
            break;
          case 'LAB_TECH':
          case 'LAB_STAFF':
            targetRoute = '/staff/lab';
            break;
          case 'PHARMACIST':
            targetRoute = '/staff/pharmacy';
            break;
          case 'BILLING_CLERK':
            targetRoute = '/staff/billing';
            break;
          case 'NURSE':
            targetRoute = '/staff/nurse';
            break;
          case 'RECEPTIONIST':
            targetRoute = '/staff/opd';
            break;
          default:
            targetRoute = '/staff/opd';
            break;
        }
      }

      window.history.pushState({}, '', targetRoute);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Invalid email or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = () => {
    setError('');
    setNotice(
      'Password recovery is coming soon. Please contact your hospital administrator for now.'
    );
  };

  const goToRegister = () => {
    window.history.pushState({}, '', '/register');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <main className="auth-shell">
      <section className="brand-panel" aria-label="MediQ introduction">
        <div className="brand-top">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <span className="brand-name">MediQ</span>

          <span className="live-pill">
            <i />
            {currentTime.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>

        <div className="pulse-area" aria-hidden="true">
          <div className="grid-glow" />

          <svg viewBox="0 0 720 180" preserveAspectRatio="none">
            <path
              className="pulse-shadow"
              d="M0 91 H155 L178 91 L198 43 L224 137 L249 69 L275 91 H720"
            />

            <path
              className="pulse-line"
              d="M0 91 H155 L178 91 L198 43 L224 137 L249 69 L275 91 H720"
            />
          </svg>
        </div>

        <div className="brand-copy">
          <p className="eyebrow">HOSPITAL OPERATIONS, CONNECTED</p>

          <h1>
            Better flow.
            <br />
            Faster care.
            <br />
            <em>Every patient.</em>
          </h1>

          <p className="brand-description">
            MediQ connects patients, doctors, and hospital teams through one
            intelligent care journey — from appointment to recovery.
          </p>
        </div>

        <div className="metrics">
          <div>
            <strong>18%</strong>
            <span>Faster bed turnover</span>
          </div>

          <div>
            <strong>
              6.2 <small>min</small>
            </strong>
            <span>Average handoff time</span>
          </div>

          <div>
            <strong>24/7</strong>
            <span>Live coordination</span>
          </div>
        </div>

        <div className="brand-footer">
          MEDIQ HEALTH SYSTEMS <span>•</span> REAL-TIME CARE INFRASTRUCTURE
        </div>
      </section>

      <section className="form-panel">
        <div className="form-container">
          <div className="mobile-brand">MediQ</div>

          <div className="form-heading">
            <p className="form-kicker">SECURE ACCESS</p>

            <h2>Welcome back.</h2>

            <p>Sign in to continue to your MediQ care workspace.</p>
          </div>

          {sessionExpiredMessage && (
            <Alert
              type="warning"
              className="mb-4"
              onClose={() => setSessionExpiredMessage(null)}
            >
              {sessionExpiredMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <label>
              Email address
              <div className="input-wrap">
                <span className="input-icon">@</span>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@hospital.org or patient@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label>
              Password
              <div className="input-wrap">
                <span className="input-icon">◆</span>

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {error && (
              <div className="form-message error" role="alert">
                {error}
              </div>
            )}

            {notice && (
              <div className="form-message notice" role="status">
                {notice}
              </div>
            )}

            <button
              className="submit-button"
              type="submit"
              disabled={loading}
            >
              <span>{loading ? 'Connecting…' : 'Sign in'}</span>

              {!loading && <span className="arrow">→</span>}
            </button>
          </form>

          <div className="form-actions">
            <button
              type="button"
              className="text-button"
              onClick={forgotPassword}
            >
              Forgot password?
            </button>

            <button
              type="button"
              className="text-button primary"
              onClick={goToRegister}
            >
              New patient? Create an account
            </button>
          </div>

          <div className="admin-note">
            <span>i</span>
            Hospital staff, doctor, and administrator accounts are provisioned by hospital management.
          </div>

          <div className="security-note">
            <span>▣</span>
            Your connection is protected with secure authentication.
          </div>
        </div>
      </section>
    </main>
  );
}
