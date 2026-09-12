import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type AccountType = 'patient' | 'doctor'
type AuthMode = 'login' | 'register'

type AuthResponse = {
  token: string
  user?: { id?: string; name?: string; email?: string; role?: string }
  doctor?: {
    id: string
    name: string
    email: string
    specialization?: string
    department?: string
  }
}

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000'
).replace(/\/$/, '')

function getStoredRole() {
  return localStorage.getItem('hospital_flow_role')
}

function App() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)

    window.addEventListener('popstate', onPopState)

    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (path !== '/patient' && path !== '/doctor') return

    const expectedRole = path === '/doctor' ? 'DOCTOR' : 'PATIENT'

    if (getStoredRole() !== expectedRole) {
      window.history.replaceState({}, '', '/login')
      setPath('/login')
    }
  }, [path])

  if (path === '/patient' && getStoredRole() === 'PATIENT') {
    return <Dashboard role="PATIENT" />
  }

  if (path === '/doctor' && getStoredRole() === 'DOCTOR') {
    return <Dashboard role="DOCTOR" />
  }

  return <LoginPage />
}

function LoginPage() {
  const [accountType, setAccountType] = useState<AccountType>('patient')
  const [mode, setMode] = useState<AuthMode>('login')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Real-time clock for the MediQ header
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (accountType === 'doctor') {
      setMode('login')
    }

    setError('')
    setNotice('')
  }, [accountType])

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setNotice('')

    if (mode === 'register' && !name.trim()) {
      setError('Please enter your full name.')
      return
    }

    setLoading(true)

    try {
      const endpoint =
        accountType === 'doctor'
          ? '/doctors/login'
          : mode === 'register'
            ? '/auth/register'
            : '/auth/login'

      const body =
        mode === 'register'
          ? {
              name: name.trim(),
              email: email.trim(),
              password,
            }
          : {
              email: email.trim(),
              password,
            }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = (await response.json().catch(() => ({}))) as AuthResponse & {
        message?: string
      }

      if (!response.ok || !data.token) {
        throw new Error(
          data.message ||
            'Unable to sign in. Please check your details and try again.',
        )
      }

      const role = accountType === 'doctor' ? 'DOCTOR' : 'PATIENT'

      localStorage.setItem('hospital_flow_token', data.token)
      localStorage.setItem('hospital_flow_role', role)
      localStorage.setItem('hospital_flow_email', email.trim())

      if (name.trim()) {
        localStorage.setItem('hospital_flow_name', name.trim())
      }

      window.history.pushState(
        {},
        '',
        role === 'DOCTOR' ? '/doctor' : '/patient',
      )

      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  function forgotPassword() {
    setError('')
    setNotice(
      'Password recovery is coming soon. Please contact your hospital administrator for now.',
    )
  }

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

            <h2>
              {mode === 'login' ? 'Welcome back.' : 'Create your account'}
            </h2>

            <p>
              {mode === 'login'
                ? 'Sign in to continue to your MediQ care workspace.'
                : 'Set up your patient account in less than a minute.'}
            </p>
          </div>

          <div
            className="account-toggle"
            role="tablist"
            aria-label="Account type"
          >
            <button
              type="button"
              role="tab"
              aria-selected={accountType === 'patient'}
              className={accountType === 'patient' ? 'active' : ''}
              onClick={() => setAccountType('patient')}
            >
              <span className="toggle-icon">♡</span>
              Patient
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={accountType === 'doctor'}
              className={accountType === 'doctor' ? 'active' : ''}
              onClick={() => setAccountType('doctor')}
            >
              <span className="toggle-icon">✚</span>
              Doctor
            </button>
          </div>

          {mode === 'register' && (
            <div className="info-banner">
              <span>✦</span>

              <div>
                <strong>Patient registration</strong>
                <br />
                Use the same email and password you will use for future visits.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <label>
                Full name

                <div className="input-wrap">
                  <span className="input-icon">⌁</span>

                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </div>
              </label>
            )}

            <label>
              Email address

              <div className="input-wrap">
                <span className="input-icon">@</span>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
                  autoComplete={
                    mode === 'register'
                      ? 'new-password'
                      : 'current-password'
                  }
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
              <span>
                {loading
                  ? 'Connecting…'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create account'}
              </span>

              {!loading && <span className="arrow">→</span>}
            </button>
          </form>

          <div className="form-actions">
            {mode === 'login' && (
              <button
                type="button"
                className="text-button"
                onClick={forgotPassword}
              >
                Forgot password?
              </button>
            )}

            {accountType === 'patient' && (
              <button
                type="button"
                className="text-button primary"
                onClick={() =>
                  switchMode(mode === 'login' ? 'register' : 'login')
                }
              >
                {mode === 'login'
                  ? 'Create an account'
                  : 'Back to sign in'}
              </button>
            )}
          </div>

          {accountType === 'doctor' && mode === 'login' && (
            <div className="admin-note">
              <span>i</span>
              Doctor accounts are created by hospital administrators.
            </div>
          )}

          <div className="security-note">
            <span>▣</span>
            Your connection is protected with secure authentication.
          </div>
        </div>
      </section>
    </main>
  )
}

function Dashboard({ role }: { role: 'PATIENT' | 'DOCTOR' }) {
  const name =
    localStorage.getItem('hospital_flow_name') ||
    (role === 'DOCTOR' ? 'Doctor' : 'Patient')

  const email = localStorage.getItem('hospital_flow_email') || ''

  function signOut() {
    localStorage.removeItem('hospital_flow_token')
    localStorage.removeItem('hospital_flow_role')
    localStorage.removeItem('hospital_flow_email')
    localStorage.removeItem('hospital_flow_name')

    window.history.pushState({}, '', '/login')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <main className="dashboard-shell">
      <div className="dashboard-card">
        <div className="brand-top compact">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          <span className="brand-name">MediQ</span>
        </div>

        <span className="dashboard-role">{role}</span>

        <h1>Welcome, {name}.</h1>

        <p>You are authenticated successfully.</p>

        <div className="dashboard-meta">{email}</div>

        <button
          className="submit-button dashboard-logout"
          onClick={signOut}
        >
          Sign out <span>→</span>
        </button>
      </div>
    </main>
  )
}

export default App