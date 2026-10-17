
import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
  Zap,
} from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import './auth.css'

type AuthMode = 'login' | 'signup' | 'reset'

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError('')
    setSuccess('')
    setPassword('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }

    if (mode !== 'reset' && password.length < 6) {
      setError('Your password must contain at least 6 characters.')
      return
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        const cleanName = name.trim()

        const baseUsername =
          cleanName
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 20) || 'student'

        const { data, error: authError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                display_name: cleanName,
                username: baseUsername,
              },
              emailRedirectTo: window.location.origin,
            },
          })

        if (authError) throw authError

        if (data.session) {
          setSuccess('Your account has been created successfully!')
        } else {
          setSuccess(
            'Registration successful! Check your email for the confirmation link before logging in.',
          )
        }
      } else if (mode === 'login') {
        const { error: authError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          })

        if (authError) throw authError
      } else {
        const { error: authError } =
          await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: `${window.location.origin}/reset-password`,
          })

        if (authError) throw authError

        setSuccess(
          'If the address is registered, you should receive a password reset email. Check your inbox.',
        )
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <a
          className="auth-brand"
          href="/"
          aria-label="FOCENTRA home"
          onClick={(event) => event.preventDefault()}
        >
          <span className="auth-brand-icon">
            <Zap size={23} fill="currentColor" />
          </span>
          <span>FOCENTRA</span>
        </a>

        <div className="auth-showcase-content">
          <div className="auth-pill">
            <Sparkles size={15} />
            YOUR PERSONAL STUDY SPACE
          </div>

          <h1>
            Make every
            <br />
            minute <span>count.</span>
          </h1>

          <p>
            Find your focus, build better study habits, and make
            progress towards the things that matter to you.
          </p>

          <div className="auth-benefits">
            <div>
              <span className="auth-benefit-icon">01</span>
              <span>
                <strong>Focus with purpose</strong>
                <small>Build consistent study routines.</small>
              </span>
            </div>

            <div>
              <span className="auth-benefit-icon">02</span>
              <span>
                <strong>Grow together</strong>
                <small>Connect with your real study circle.</small>
              </span>
            </div>

            <div>
              <span className="auth-benefit-icon">03</span>
              <span>
                <strong>Track your progress</strong>
                <small>Keep your goals moving forward.</small>
              </span>
            </div>
          </div>
        </div>

        <div className="auth-showcase-footer">
          Focus on progress, not perfection.
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-container">
          <div className="auth-mobile-brand">
            <span className="auth-brand-icon">
              <Zap size={22} fill="currentColor" />
            </span>
            <strong>FOCENTRA</strong>
          </div>

          <div className="auth-heading">
            <span className="auth-heading-icon">
              {mode === 'reset' ? (
                <LockKeyhole size={23} />
              ) : (
                <Sparkles size={23} />
              )}
            </span>

            <h2>
              {mode === 'login'
                ? 'Welcome back'
                : mode === 'signup'
                  ? 'Create your account'
                  : 'Reset your password'}
            </h2>

            <p>
              {mode === 'login'
                ? 'Sign in to continue your journey.'
                : mode === 'signup'
                  ? 'Start building better study habits today.'
                  : 'We will send you a password reset link.'}
            </p>
          </div>

          {mode !== 'reset' && (
            <div className="auth-mode-switch">
              <button
                type="button"
                className={mode === 'login' ? 'active' : ''}
                onClick={() => changeMode('login')}
              >
                Log in
              </button>

              <button
                type="button"
                className={mode === 'signup' ? 'active' : ''}
                onClick={() => changeMode('signup')}
              >
                Sign up
              </button>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <label className="auth-field">
                <span>Full name</span>

                <div className="auth-input-wrap">
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    required
                  />
                </div>
              </label>
            )}

            <label className="auth-field">
              <span>Email address</span>

              <div className="auth-input-wrap">
                <Mail size={18} />

                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </label>

            {mode !== 'reset' && (
              <label className="auth-field">
                <span>Password</span>

                <div className="auth-input-wrap">
                  <LockKeyhole size={18} />

                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      mode === 'signup'
                        ? 'new-password'
                        : 'current-password'
                    }
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={6}
                    required
                  />

                  <button
                    className="auth-password-toggle"
                    type="button"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    onClick={() =>
                      setShowPassword((visible) => !visible)
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </label>
            )}

            {mode === 'login' && (
              <div className="auth-forgot-row">
                <button
                  type="button"
                  onClick={() => changeMode('reset')}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="auth-feedback auth-error" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="auth-feedback auth-success" role="status">
                {success}
              </div>
            )}

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Log in'
                  : mode === 'signup'
                    ? 'Create account'
                    : 'Send reset link'}

              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {mode === 'reset' ? (
            <p className="auth-switch-copy">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => changeMode('login')}
              >
                Back to login
              </button>
            </p>
          ) : (
            <p className="auth-switch-copy">
              {mode === 'login'
                ? "Don't have an account?"
                : 'Already have an account?'}{' '}

              <button
                type="button"
                onClick={() =>
                  changeMode(mode === 'login' ? 'signup' : 'login')
                }
              >
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>
          )}

          <p className="auth-privacy">
            Your account is secured by Supabase Authentication.
          </p>
        </div>
      </section>
    </main>
  )
}
