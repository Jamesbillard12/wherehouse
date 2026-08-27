import {
  createHousehold,
  createPairingSession,
  getMe,
  listDevices,
  listHouseholds,
  login,
  logout,
  register,
  revokeDevice,
  type Device,
  type Household,
  type MeResponse,
  type PairingSession,
} from '@wherehouse/api-client'
import QRCode from 'qrcode'
import { type FormEvent, useEffect, useMemo, useState } from 'react'

const SESSION_KEY = 'wherehouse.web.session'

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong.'
}

function formatDate(value: string | null): string {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? '')
  const [me, setMe] = useState<MeResponse | null>(null)
  const [households, setHouseholds] = useState<Household[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState<string | null>(null)

  async function loadAccount(accessToken: string) {
    setLoading(true)
    setError(null)
    try {
      const [account, householdList] = await Promise.all([
        getMe(accessToken),
        listHouseholds(accessToken),
      ])
      setMe(account)
      setHouseholds(householdList)
      setSelectedId((current) =>
        householdList.some((household) => household.id === current)
          ? current
          : (householdList[0]?.id ?? ''),
      )
    } catch (reason) {
      sessionStorage.removeItem(SESSION_KEY)
      setToken('')
      setMe(null)
      setError(message(reason))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) void loadAccount(token)
  }, [])

  function acceptToken(accessToken: string) {
    sessionStorage.setItem(SESSION_KEY, accessToken)
    setToken(accessToken)
    void loadAccount(accessToken)
  }

  async function signOut() {
    try {
      await logout(token)
    } finally {
      sessionStorage.removeItem(SESSION_KEY)
      setToken('')
      setMe(null)
      setHouseholds([])
    }
  }

  async function addHousehold(name: string) {
    const household = await createHousehold(token, name)
    setHouseholds((current) => [...current, household])
    setSelectedId(household.id)
    setMe(await getMe(token))
  }

  if (!token || !me) {
    return <AuthScreen busy={loading} initialError={error} onAuthenticated={acceptToken} />
  }

  if (!households.length) {
    return <HouseholdSetup user={me} onCreate={addHousehold} onSignOut={signOut} />
  }

  const selected = households.find((household) => household.id === selectedId) ?? households[0]
  const membership = me.households.find((access) => access.household_id === selected.id)

  return (
    <Dashboard
      household={selected}
      households={households}
      isOwner={membership?.relationship_type === 'owner'}
      onSelect={setSelectedId}
      onSignOut={signOut}
      token={token}
      user={me}
    />
  )
}

function AuthScreen({
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
        <a className="wordmark" href="/">WH<span>·</span></a>
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

function HouseholdSetup({
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
        <span className="wordmark dark">WH<span>·</span></span>
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

function Dashboard({
  household,
  households,
  isOwner,
  onSelect,
  onSignOut,
  token,
  user,
}: {
  household: Household
  households: Household[]
  isOwner: boolean
  onSelect: (id: string) => void
  onSignOut: () => Promise<void>
  token: string
  user: MeResponse
}) {
  const [devices, setDevices] = useState<Device[]>([])
  const [pairing, setPairing] = useState<PairingSession | null>(null)
  const [pairingDeviceBaseline, setPairingDeviceBaseline] = useState(0)
  const [qrCode, setQrCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refreshDevices(): Promise<Device[]> {
    if (!isOwner) return []
    try {
      const nextDevices = await listDevices(token, household.id)
      setDevices(nextDevices)
      return nextDevices
    } catch (reason) {
      setError(message(reason))
      return []
    }
  }

  useEffect(() => {
    setPairing(null)
    setQrCode('')
    setError(null)
  }, [household.id])

  useEffect(() => {
    if (!isOwner) return

    let cancelled = false
    async function checkDevices() {
      const nextDevices = await listDevices(token, household.id)
      if (cancelled) return
      const nextActiveDevices = nextDevices.filter((device) => device.is_active)
      setDevices(nextDevices)
      if (pairing && nextActiveDevices.length > pairingDeviceBaseline) {
        setPairing(null)
        setQrCode('')
      }
    }

    void checkDevices().catch((reason) => !cancelled && setError(message(reason)))
    const interval = window.setInterval(
      () => void checkDevices().catch((reason) => !cancelled && setError(message(reason))),
      pairing ? 2_000 : 15_000,
    )
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [household.id, isOwner, pairing?.id, pairingDeviceBaseline, token])

  useEffect(() => {
    if (!pairing) return
    void QRCode.toDataURL(pairing.pairing_uri, { margin: 1, width: 320 }).then(setQrCode)
  }, [pairing])

  const activeDevices = useMemo(() => devices.filter((device) => device.is_active), [devices])

  async function generatePairing() {
    setBusy(true)
    setError(null)
    try {
      const currentDevices = await refreshDevices()
      setPairingDeviceBaseline(currentDevices.filter((device) => device.is_active).length)
      const instanceType = location.hostname === 'localhost' ? 'local' : 'cloud'
      setPairing(
        await createPairingSession(token, household.id, {
          instance_name: `${household.name} WhereHouse`,
          instance_type: instanceType,
        }),
      )
    } catch (reason) {
      setError(message(reason))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(device: Device) {
    if (!confirm(`Revoke ${device.name}? It will no longer be able to sync.`)) return
    await revokeDevice(token, device.id)
    await refreshDevices()
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <span className="wordmark dark">WH<span>·</span></span>
        <div className="account-menu">
          <span>{user.user.display_name}</span>
          <button className="text-button" onClick={() => void onSignOut()}>Sign out</button>
        </div>
      </header>

      <aside className="sidebar">
        <p className="nav-label">Household</p>
        <select value={household.id} onChange={(event) => onSelect(event.target.value)}>
          {households.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
        <nav>
          <a className="nav-item active" href="#overview"><span>⌂</span> Overview</a>
          <a className="nav-item" href="#pair"><span>⌁</span> Companion</a>
          <span className="nav-item disabled"><span>□</span> Inventory <small>Next</small></span>
        </nav>
        <div className="server-status"><span /> Server connected</div>
      </aside>

      <section className="dashboard-content">
        <div className="page-heading" id="overview">
          <div>
            <p className="eyebrow">Household overview</p>
            <h1>{household.name}</h1>
          </div>
          <div className="role-badge">{isOwner ? 'Owner' : 'Borrower'}</div>
        </div>

        <div className="stat-grid">
          <article><strong>0</strong><span>Items tracked</span></article>
          <article><strong>0</strong><span>Containers</span></article>
          <article><strong>{activeDevices.length}</strong><span>Active devices</span></article>
        </div>

        <section className="panel pairing-panel" id="pair">
          <div className="panel-copy">
            <p className="eyebrow">Companion app</p>
            <h2>Take your inventory with you.</h2>
            <p className="muted">
              Generate a one-time code, then scan it with the WhereHouse companion. It expires in
              ten minutes and can only be used once.
            </p>
            {isOwner ? (
              <button className="primary-button compact" disabled={busy} onClick={() => void generatePairing()}>
                {busy ? 'Generating…' : pairing ? 'Generate a new code' : 'Pair a device'}
              </button>
            ) : <p className="notice">Only a household owner can pair devices.</p>}
            {error ? <div className="alert">{error}</div> : null}
          </div>
          <div className={`qr-stage ${pairing ? 'ready' : ''}`}>
            {pairing && qrCode ? (
              <>
                <img alt="One-time WhereHouse companion pairing QR code" src={qrCode} />
                <strong>Scan with WhereHouse</strong>
                <span>Expires {formatDate(pairing.expires_at)}</span>
                <button className="text-button" onClick={() => void navigator.clipboard.writeText(pairing.pairing_uri)}>
                  Copy pairing link
                </button>
              </>
            ) : (
              <><div className="qr-placeholder">⌁</div><span>Your pairing code will appear here.</span></>
            )}
          </div>
        </section>

        {isOwner ? (
          <section className="panel device-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Access</p><h2>Paired devices</h2></div>
              <div className="live-status"><span /> Live</div>
            </div>
            {activeDevices.length ? (
              <div className="device-list">
                {activeDevices.map((device) => (
                  <article key={device.id}>
                    <div className="device-icon">{device.device_type === 'phone' ? '▯' : '□'}</div>
                    <div><strong>{device.name}</strong><span>{device.device_type} · Last seen {formatDate(device.last_seen_at)}</span></div>
                    <button className="danger-button" onClick={() => void revoke(device)}>Revoke</button>
                  </article>
                ))}
              </div>
            ) : <div className="empty-state">No companion devices have been paired yet.</div>}
          </section>
        ) : null}
      </section>
    </main>
  )
}
