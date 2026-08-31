import { type MeResponse } from '@wherehouse/api-client'
import { House } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { message } from '../../shared/utils/errors'

export function HouseholdSetup({
  user,
  onCreate,
  onSignOut,
}: {
  user: MeResponse
  onCreate: (name: string) => Promise<void>
  onSignOut: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onCreate(String(new FormData(event.currentTarget).get('name')))
    } catch (reason) {
      setError(message(reason))
      setBusy(false)
    }
  }

  return (
    <main className="setup-layout">
      <nav className="simple-nav">
        <span className="wordmark dark"><span className="brand-mark"><House aria-hidden="true" /></span> WhereHouse</span>
        <button className="text-button" onClick={() => void onSignOut()}>Sign out</button>
      </nav>
      <section className="setup-card">
        <span className="step-number">01</span>
        <p className="eyebrow">Hello, {user.user.display_name}</p>
        <h1>Name your household.</h1>
        <p className="muted">This is the home base for every area, container, item, and paired device.</p>
        <form onSubmit={submit}>
          <label>
            Household name
            <input autoFocus name="name" placeholder="The Billard household" required />
          </label>
          {error ? <div className="alert">{error}</div> : null}
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? 'Creating…' : 'Create household'}
          </button>
        </form>
      </section>
    </main>
  )
}


