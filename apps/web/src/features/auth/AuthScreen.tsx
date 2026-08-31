import { login, register } from '@wherehouse/api-client'
import { type FormEvent, useEffect, useState } from 'react'

import { message } from '../../shared/utils/errors'

export function AuthScreen({
  busy,
  initialError,
  onAuthenticated,
}: {
  busy: boolean
  initialError: string | null
  onAuthenticated: (token: string) => void
}) {
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  useEffect(() => setError(initialError), [initialError])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const response =
        mode === 'register'
          ? await register({
              email: String(data.get('email')),
              display_name: String(data.get('displayName')),
              password: String(data.get('password')),
            })
          : await login({
              email: String(data.get('email')),
              password: String(data.get('password')),
            })
      onAuthenticated(response.access_token)
    } catch (reason) {
      setError(message(reason))
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <a aria-label="WhereHouse home" className="wordmark" href="/"><img alt="WhereHouse" className="brand-logo" src="/logo.png" /></a>
        <div>
          <p className="kicker">Your household, accounted for.</p>
          <h1>Find the thing.<br />Every time.</h1>
          <p className="lede">
            A calm, private inventory for garages, sheds, trailers, closets, and everywhere in
            between.
          </p>
        </div>
        <p className="story-note">Self-host it at home or take it to the cloud.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">{mode === 'register' ? 'Start organizing' : 'Welcome back'}</p>
          <h2>{mode === 'register' ? 'Create your account' : 'Sign in to WhereHouse'}</h2>
          <p className="muted">
            {mode === 'register'
              ? 'You’ll create your household next.'
              : 'Use the account connected to your household.'}
          </p>
          <form onSubmit={submit}>
            {mode === 'register' ? (
              <label>
                Your name
                <input autoComplete="name" name="displayName" required />
              </label>
            ) : null}
            <label>
              Email
              <input autoComplete="email" name="email" required type="email" />
            </label>
            <label>
              Password
              <input
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={mode === 'register' ? 10 : 1}
                name="password"
                required
                type="password"
              />
              {mode === 'register' ? <span className="field-note">At least 10 characters</span> : null}
            </label>
            {error ? <div className="alert">{error}</div> : null}
            <button className="primary-button" disabled={busy || submitting} type="submit">
              {submitting || busy ? 'One moment…' : mode === 'register' ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === 'register' ? 'login' : 'register')
              setError(null)
            }}
            type="button"
          >
            {mode === 'register' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
        </div>
      </section>
    </main>
  )
}

