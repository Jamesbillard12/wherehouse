import {
  createArea,
  createContainer,
  createHousehold,
  createPairingSession,
  createZone,
  deleteArea,
  deleteContainer,
  getMe,
  listAreas,
  listContainerPlacements,
  listContainers,
  listDevices,
  listHouseholds,
  listZones,
  login,
  logout,
  placeContainer,
  register,
  removeContainerPlacement,
  revokeDevice,
  setContainerSpace,
  updateAreaIcon,
  updateContainer,
  updateZone,
  type Area,
  type ContainerPlacement,
  type ContainerType,
  type Device,
  type Household,
  type MeResponse,
  type PairingSession,
  type StorageContainer,
  type Zone,
} from '@wherehouse/api-client'
import QRCode from 'qrcode'
import {
  Activity,
  ArrowRightLeft,
  Bell,
  Building2,
  Box,
  Camera,
  Caravan,
  CircleOff,
  ChevronRight,
  Clock3,
  Container,
  House,
  Hammer,
  Laptop,
  MapPin,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Radio,
  Search,
  Settings,
  Smartphone,
  Trash2,
  TreePine,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'

const SESSION_KEY = 'wherehouse.web.session'
const SIDEBAR_KEY = 'wherehouse.web.sidebar-collapsed'
const HOUSEHOLD_KEY = 'wherehouse.web.selected-household'

type DashboardView = 'overview' | 'locations'

function viewFromLocation(): DashboardView {
  return location.pathname === '/locations' ? 'locations' : 'overview'
}

function areaKey(householdId: string): string {
  return `wherehouse.web.selected-area.${householdId}`
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong.'
}

function formatDate(value: string | null): string {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? '')
  const [me, setMe] = useState<MeResponse | null>(null)
  const [households, setHouseholds] = useState<Household[]>([])
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(HOUSEHOLD_KEY) ?? '')
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
    localStorage.setItem(HOUSEHOLD_KEY, household.id)
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
      onSelect={(id) => {
        setSelectedId(id)
        localStorage.setItem(HOUSEHOLD_KEY, id)
      }}
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
        <a className="wordmark" href="/"><span className="brand-mark"><House aria-hidden="true" /></span> WhereHouse</a>
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
  const [activeView, setActiveView] = useState<DashboardView>(viewFromLocation)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) === 'true',
  )
  const [devices, setDevices] = useState<Device[]>([])
  const [pairing, setPairing] = useState<PairingSession | null>(null)
  const [pairingDeviceBaseline, setPairingDeviceBaseline] = useState(0)
  const [qrCode, setQrCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (location.pathname !== '/overview' && location.pathname !== '/locations') {
      history.replaceState({}, '', `/${activeView}`)
    }
    const handleNavigation = () => setActiveView(viewFromLocation())
    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  useEffect(() => {
    if (activeView === 'overview' && location.hash) {
      requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView())
    }
  }, [activeView])

  function navigate(view: DashboardView, hash = '') {
    const destination = `/${view}${hash}`
    if (`${location.pathname}${location.hash}` !== destination) {
      history.pushState({}, '', destination)
    }
    setActiveView(view)
    if (hash) requestAnimationFrame(() => document.querySelector(hash)?.scrollIntoView())
  }

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
    <main className={`dashboard ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="topbar">
        <span className="wordmark dark"><span className="brand-mark"><House aria-hidden="true" /></span> WhereHouse</span>
        <div className="global-search"><Search aria-hidden="true" /> <span>Search items, containers, locations</span></div>
        <div className="account-menu">
          <span className="topbar-icon"><Bell aria-hidden="true" /></span>
          <span className="avatar">{user.user.display_name.slice(0, 1).toUpperCase()}</span>
          <button className="text-button" onClick={() => void onSignOut()}>Sign out</button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-controls">
          <button
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="collapse-button"
            onClick={() => {
              const next = !sidebarCollapsed
              setSidebarCollapsed(next)
              localStorage.setItem(SIDEBAR_KEY, String(next))
            }}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </button>
        </div>
        <div className="sidebar-household">
          <p className="nav-label">Household</p>
          <select value={household.id} onChange={(event) => onSelect(event.target.value)}>
          {households.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </div>
        <nav>
          <a aria-label="Overview" className={`nav-item ${activeView === 'overview' ? 'active' : ''}`} href="/overview" onClick={(event) => { event.preventDefault(); navigate('overview') }} title="Overview"><House aria-hidden="true" /><span>Overview</span></a>
          <button aria-label="Items" className="nav-item disabled" disabled title="Items"><Box aria-hidden="true" /><span>Items</span><small>Next</small></button>
          <a aria-label="Locations" className={`nav-item ${activeView === 'locations' ? 'active' : ''}`} href="/locations" onClick={(event) => { event.preventDefault(); navigate('locations') }} title="Locations"><MapPin aria-hidden="true" /><span>Locations</span></a>
          <button aria-label="Activity" className="nav-item disabled" disabled title="Activity"><Activity aria-hidden="true" /><span>Activity</span></button>
          <button aria-label="Transfers" className="nav-item disabled" disabled title="Transfers"><ArrowRightLeft aria-hidden="true" /><span>Transfers</span></button>
          <button aria-label="Checkouts" className="nav-item disabled" disabled title="Checkouts"><Clock3 aria-hidden="true" /><span>Checkouts</span></button>
          <a aria-label="Companion" className="nav-item" href="/overview#pair" onClick={(event) => { event.preventDefault(); navigate('overview', '#pair') }} title="Companion"><QrCode aria-hidden="true" /><span>Companion</span></a>
          <button aria-label="Settings" className="nav-item disabled" disabled title="Settings"><Settings aria-hidden="true" /><span>Settings</span></button>
        </nav>
        <div className="sidebar-footer">
          <div className="server-status" title="Server connected"><i /><span>Server connected</span></div>
        </div>
      </aside>

      <section className="dashboard-content">
        {activeView === 'locations' ? (
          <LocationsView household={household} token={token} />
        ) : (
        <>
        <div className="page-heading" id="overview">
          <div>
            <p className="eyebrow">{household.name}</p>
            <h1>{greeting()}, {user.user.display_name.split(' ')[0]} <span className="wave">👋</span></h1>
          </div>
          <button className="primary-button compact disabled-action" disabled><Plus aria-hidden="true" /> Add</button>
        </div>

        <div className="stat-grid">
          <article><strong>0</strong><span>Items tracked</span></article>
          <article><strong>0</strong><span>Containers</span></article>
          <article><strong>0</strong><span>Locations</span></article>
          <article><strong>0</strong><span>Checked out</span></article>
        </div>

        <section className="overview-grid">
          <article className="overview-card">
            <div className="card-heading"><h2>Locations overview</h2><MapPin aria-hidden="true" /></div>
            <div className="empty-illustration"><House aria-hidden="true" /></div>
            <strong>No locations yet</strong>
            <p>Create an area such as a garage, attic, or trailer to begin organizing.</p>
            <a className="inline-link" href="/locations" onClick={(event) => { event.preventDefault(); navigate('locations') }}>View all locations →</a>
          </article>
          <article className="overview-card">
            <div className="card-heading"><h2>Recently added items</h2><Box aria-hidden="true" /></div>
            <div className="empty-illustration"><PackagePlus aria-hidden="true" /></div>
            <strong>Your inventory is ready</strong>
            <p>Items you add will appear here with their exact location path.</p>
            <button className="inline-link" disabled>View all items →</button>
          </article>
          <article className="overview-card">
            <div className="card-heading"><h2>Recent activity</h2><Activity aria-hidden="true" /></div>
            <div className="empty-illustration"><Clock3 aria-hidden="true" /></div>
            <strong>No activity yet</strong>
            <p>Additions, moves, checkouts, and returns will be recorded here.</p>
            <button className="inline-link" disabled>View all activity →</button>
          </article>
        </section>

        <section className="quick-grid">
          <article><div className="quick-icon"><ArrowRightLeft aria-hidden="true" /></div><div><strong>Transfer items</strong><span>Move inventory between locations.</span></div><small>Coming next</small></article>
          <article><div className="quick-icon"><Camera aria-hidden="true" /></div><div><strong>AI item capture</strong><span>Photograph an item and review suggestions.</span></div><small>Coming next</small></article>
          <article><div className="quick-icon"><Printer aria-hidden="true" /></div><div><strong>Print labels</strong><span>Create QR labels for items and containers.</span></div><small>Coming next</small></article>
        </section>

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
              <><div className="qr-placeholder"><QrCode aria-hidden="true" /></div><span>Your pairing code will appear here.</span></>
            )}
          </div>
        </section>

        {isOwner ? (
          <section className="panel device-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Access · {activeDevices.length} active</p><h2>Paired devices</h2></div>
              <div className="live-status"><span /> Live</div>
            </div>
            {activeDevices.length ? (
              <div className="device-list">
                {activeDevices.map((device) => (
                  <article key={device.id}>
                    <div className="device-icon">{device.device_type === 'phone' ? <Smartphone aria-hidden="true" /> : <Laptop aria-hidden="true" />}</div>
                    <div><strong>{device.name}</strong><span>{device.device_type} · Last seen {formatDate(device.last_seen_at)}</span></div>
                    <button className="danger-button" onClick={() => void revoke(device)}>Revoke</button>
                  </article>
                ))}
              </div>
            ) : <div className="empty-state">No companion devices have been paired yet.</div>}
          </section>
        ) : null}
        </>
        )}
      </section>
    </main>
  )
}

const CONTAINER_TYPES: Array<{ value: ContainerType; label: string }> = [
  { value: 'bin', label: 'Bin' },
  { value: 'box', label: 'Box' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'shelving_unit', label: 'Shelving unit' },
  { value: 'cabinet', label: 'Cabinet' },
  { value: 'drawer', label: 'Drawer' },
  { value: 'toolbox', label: 'Toolbox' },
  { value: 'bag', label: 'Bag' },
  { value: 'case', label: 'Case' },
  { value: 'rack', label: 'Rack' },
  { value: 'hook', label: 'Hook' },
  { value: 'workbench', label: 'Workbench' },
  { value: 'other', label: 'Other' },
]

const AREA_ICONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: 'warehouse', label: 'Garage', icon: Warehouse },
  { value: 'house', label: 'House', icon: House },
  { value: 'building', label: 'Building', icon: Building2 },
  { value: 'tree', label: 'Shed', icon: TreePine },
  { value: 'caravan', label: 'Trailer', icon: Caravan },
  { value: 'hammer', label: 'Workshop', icon: Hammer },
  { value: 'box', label: 'Storage', icon: Box },
]

function AreaIcon({ name }: { name: string }) {
  const Icon = AREA_ICONS.find((option) => option.value === name)?.icon ?? Warehouse
  return <Icon aria-hidden="true" />
}

function AreaIconPicker({ defaultValue = 'warehouse' }: { defaultValue?: string }) {
  return (
    <fieldset className="icon-picker">
      <legend>Icon</legend>
      <div>
        {AREA_ICONS.map((option) => (
          <label key={option.value} title={option.label}>
            <input defaultChecked={option.value === defaultValue} name="icon" type="radio" value={option.value} />
            <span><AreaIcon name={option.value} /></span>
            <small>{option.label}</small>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function LocationsView({ household, token }: { household: Household; token: string }) {
  const [areas, setAreas] = useState<Area[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [containers, setContainers] = useState<StorageContainer[]>([])
  const [placements, setPlacements] = useState<ContainerPlacement[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [formMode, setFormMode] = useState<'area' | 'zone' | 'edit-zone' | 'container' | 'edit-container' | 'icon' | null>(null)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [selectedContainer, setSelectedContainer] = useState<StorageContainer | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadAreas(preferredId?: string) {
    const nextAreas = await listAreas(token, household.id)
    setAreas(nextAreas)
    setSelectedAreaId((current) => {
      const candidate = preferredId || current || localStorage.getItem(areaKey(household.id)) || ''
      return nextAreas.some((area) => area.id === candidate) ? candidate : (nextAreas[0]?.id ?? '')
    })
  }

  async function loadAreaDetails(areaId: string) {
    if (!areaId) {
      setZones([])
      setContainers([])
      setPlacements([])
      return
    }
    const [nextZones, nextContainers, nextPlacements] = await Promise.all([
      listZones(token, areaId),
      listContainers(token, areaId),
      listContainerPlacements(token, areaId),
    ])
    setZones(nextZones)
    setContainers(nextContainers)
    setPlacements(nextPlacements)
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    void loadAreas()
      .catch((reason) => setError(message(reason)))
      .finally(() => setLoading(false))
  }, [household.id, token])

  useEffect(() => {
    setError(null)
    if (selectedAreaId) localStorage.setItem(areaKey(household.id), selectedAreaId)
    void loadAreaDetails(selectedAreaId).catch((reason) => setError(message(reason)))
  }, [household.id, selectedAreaId, token])

  async function submitArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const area = await createArea(token, household.id, {
        name: String(data.get('name')).trim(),
        icon: String(data.get('icon')),
        description: String(data.get('description')).trim() || undefined,
      })
      await loadAreas(area.id)
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function submitAreaIcon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedArea) return
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const updated = await updateAreaIcon(token, selectedArea.id, String(data.get('icon')))
      setAreas((current) => current.map((area) => area.id === updated.id ? updated : area))
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function removeArea() {
    if (!selectedArea) return
    const detail = containers.length || zones.length
      ? ` This also removes its ${zones.length} zones and ${containers.length} containers.`
      : ''
    if (!confirm(`Delete ${selectedArea.name}?${detail} This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      await deleteArea(token, selectedArea.id)
      await loadAreas()
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function submitZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      await createZone(token, selectedAreaId, {
        name: String(data.get('name')).trim(),
        description: String(data.get('description')).trim() || undefined,
      })
      await loadAreaDetails(selectedAreaId)
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function submitZoneEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedZone) return
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const updated = await updateZone(token, selectedZone.id, {
        name: String(data.get('name')).trim(),
        description: String(data.get('description')).trim() || undefined,
      })
      setZones((current) => current.map((zone) => zone.id === updated.id ? updated : zone))
      setSelectedZone(null)
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  function editZone(zone: Zone) {
    setSelectedZone(zone)
    setFormMode('edit-zone')
  }

  async function submitContainer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const container = await createContainer(token, {
        area_id: selectedAreaId,
        zone_id: String(data.get('zoneId')) || undefined,
        name: String(data.get('name')).trim(),
        container_type: String(data.get('containerType')) as ContainerType,
        identifier_type: String(data.get('identifierType')) as StorageContainer['identifier_type'],
        description: String(data.get('description')).trim() || undefined,
        is_movable: data.get('isMovable') === 'on',
      })
      const parentId = String(data.get('parentId'))
      if (parentId) {
        await placeContainer(token, container.id, {
          parent_container_id: parentId,
          relationship_type: String(data.get('relationshipType')) as ContainerPlacement['relationship_type'],
        })
      }
      await loadAreaDetails(selectedAreaId)
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function submitContainerEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedContainer) return
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      await updateContainer(token, selectedContainer.id, {
        zone_id: String(data.get('zoneId')) || undefined,
        name: String(data.get('name')).trim(),
        identifier_type: String(data.get('identifierType')) as StorageContainer['identifier_type'],
        description: String(data.get('description')).trim() || undefined,
        is_movable: data.get('isMovable') === 'on',
      })
      const parentId = String(data.get('parentId'))
      if (parentId) {
        await placeContainer(token, selectedContainer.id, {
          parent_container_id: parentId,
          relationship_type: String(data.get('relationshipType')) as ContainerPlacement['relationship_type'],
        })
      } else if (placements.some((placement) => placement.container_id === selectedContainer.id)) {
        await removeContainerPlacement(token, selectedContainer.id)
      }
      await loadAreaDetails(selectedAreaId)
      setSelectedContainer(null)
      setFormMode(null)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  function editContainer(container: StorageContainer) {
    setSelectedContainer(container)
    setFormMode('edit-container')
  }

  async function removeContainer(container: StorageContainer) {
    const childCount = placements.filter(
      (placement) => placement.parent_container_id === container.id,
    ).length
    const childWarning = childCount
      ? ` ${childCount} nested container${childCount === 1 ? '' : 's'} will remain in the area without this parent.`
      : ''
    if (!confirm(`Delete ${container.name} (${container.code})?${childWarning} Item placements in this container will be cleared. This cannot be undone.`)) return
    setSaving(true)
    setError(null)
    try {
      await deleteContainer(token, container.id)
      await loadAreaDetails(selectedAreaId)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  async function toggleSpace(container: StorageContainer) {
    setError(null)
    try {
      const updated = await setContainerSpace(token, container.id, !container.is_out_of_space)
      setContainers((current) => current.map((entry) => entry.id === updated.id ? updated : entry))
    } catch (reason) {
      setError(message(reason))
    }
  }

  const selectedArea = areas.find((area) => area.id === selectedAreaId)
  const placementByContainer = new Map(placements.map((placement) => [placement.container_id, placement]))
  const containerById = new Map(containers.map((container) => [container.id, container]))

  return (
    <div className="locations-view">
      <div className="page-heading locations-heading">
        <div>
          <p className="eyebrow">Storage map</p>
          <h1>Locations</h1>
          <p className="page-description">Organize areas, zones, and every container inside them.</p>
        </div>
      </div>

      {error ? <div className="alert locations-alert">{error}</div> : null}

      {loading ? <div className="locations-loading">Loading locations…</div> : areas.length ? (
        <div className="locations-layout">
          <aside className="area-list" aria-label="Areas">
            <div className="section-title">
              <span>Areas <strong>{areas.length}</strong></span>
              <button aria-label="Add area" onClick={() => setFormMode('area')} title="Add area"><Plus aria-hidden="true" /></button>
            </div>
            {areas.map((area) => {
              const count = area.id === selectedAreaId ? containers.length : null
              return (
                <button className={area.id === selectedAreaId ? 'selected' : ''} key={area.id} onClick={() => setSelectedAreaId(area.id)}>
                  <span className="area-icon"><AreaIcon name={area.icon} /></span>
                  <span><strong>{area.name}</strong><small>{count === null ? 'Open area' : `${zones.length} zones · ${count} containers`}</small></span>
                  <ChevronRight aria-hidden="true" />
                </button>
              )
            })}
          </aside>

          <section className="area-detail">
            <div className="area-detail-heading">
              <div className="selected-area-title"><span className="area-icon large"><AreaIcon name={selectedArea?.icon ?? 'warehouse'} /></span><div><p className="eyebrow">Selected area</p><h2>{selectedArea?.name}</h2>{selectedArea?.description ? <p>{selectedArea.description}</p> : null}</div></div>
              <div className="area-actions">
                <button aria-label="Change area icon" className="icon-action" onClick={() => setFormMode('icon')} title="Change icon"><AreaIcon name={selectedArea?.icon ?? 'warehouse'} /></button>
                <button className="secondary-action" onClick={() => setFormMode('zone')}><Plus aria-hidden="true" /> Add zone</button>
                <button className="primary-button compact" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add container</button>
                <button aria-label={`Delete ${selectedArea?.name}`} className="icon-action danger" disabled={saving} onClick={() => void removeArea()} title="Delete area"><Trash2 aria-hidden="true" /></button>
              </div>
            </div>

            {zones.length ? (
              <div className="zone-chips">
                <span>Zones</span>
                {zones.map((zone) => <span className="zone-chip" key={zone.id}>{zone.name}<button aria-label={`Edit ${zone.name}`} onClick={() => editZone(zone)} title={`Edit ${zone.name}`}><Pencil aria-hidden="true" /></button></span>)}
                <button onClick={() => setFormMode('zone')}><Plus aria-hidden="true" /> Add zone</button>
              </div>
            ) : <div className="empty-strip"><span><MapPin aria-hidden="true" /> No zones yet. Add one to describe a shelf wall, workbench, or other section.</span><button onClick={() => setFormMode('zone')}><Plus aria-hidden="true" /> Add zone</button></div>}

            {containers.length ? (
              <div className="container-list">
                {containers.map((container) => {
                  const placement = placementByContainer.get(container.id)
                  const parent = placement ? containerById.get(placement.parent_container_id) : null
                  const zone = zones.find((entry) => entry.id === container.zone_id)
                  return (
                    <article key={container.id}>
                      <div className="container-icon"><Container aria-hidden="true" /></div>
                      <div className="container-copy">
                        <div><strong>{container.name}</strong><span className="type-badge">{container.container_type.replace('_', ' ')}</span>{container.identifier_type !== 'none' ? <span className="identifier-badge">{container.identifier_type !== 'nfc' ? <QrCode aria-hidden="true" /> : null}{container.identifier_type !== 'qr' ? <Radio aria-hidden="true" /> : null}{container.identifier_type === 'both' ? 'QR + NFC' : container.identifier_type.toUpperCase()}</span> : null}{container.is_out_of_space ? <span className="full-badge">Full</span> : null}</div>
                        <span>{[zone?.name, parent ? `${placement?.relationship_type.replace('_', ' ')} ${parent.name}` : null, container.code].filter(Boolean).join(' · ') || 'Directly in area'}</span>
                      </div>
                      <div className="container-actions"><button aria-label={`Edit ${container.name}`} className="edit-container-button" onClick={() => editContainer(container)} title={`Edit ${container.name}`}><Pencil aria-hidden="true" /></button><button aria-label={`Delete ${container.name}`} className="delete-container-button" disabled={saving} onClick={() => void removeContainer(container)} title={`Delete ${container.name}`}><Trash2 aria-hidden="true" /></button><button className="space-button" onClick={() => void toggleSpace(container)}>{container.is_out_of_space ? 'Mark available' : 'Mark full'}</button></div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="location-empty"><div className="empty-illustration"><Container aria-hidden="true" /></div><strong>No containers in {selectedArea?.name}</strong><p>Add a shelf, cabinet, bin, or any other place that can hold household items.</p><button className="primary-button compact" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add first container</button></div>
            )}
          </section>
        </div>
      ) : (
        <div className="location-empty first-area"><div className="empty-illustration"><Warehouse aria-hidden="true" /></div><strong>Create your first area</strong><p>Start with a major physical location such as a garage, attic, shed, trailer, or workshop.</p><button className="primary-button compact" onClick={() => setFormMode('area')}><Plus aria-hidden="true" /> Add area</button></div>
      )}

      {formMode ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setFormMode(null)}>
          <section aria-labelledby="location-dialog-title" aria-modal="true" className="location-dialog" role="dialog">
            <div className="dialog-heading"><div><p className="eyebrow">Location setup</p><h2 id="location-dialog-title">{formMode === 'area' ? 'Add an area' : formMode === 'zone' ? `Add a zone to ${selectedArea?.name}` : formMode === 'edit-zone' ? `Edit ${selectedZone?.name}` : formMode === 'edit-container' ? `Edit ${selectedContainer?.name}` : formMode === 'icon' ? `Choose an icon for ${selectedArea?.name}` : `Add a container to ${selectedArea?.name}`}</h2></div><button aria-label="Close" onClick={() => { setFormMode(null); setSelectedZone(null); setSelectedContainer(null) }}>×</button></div>
            <form onSubmit={formMode === 'area' ? submitArea : formMode === 'zone' ? submitZone : formMode === 'edit-zone' ? submitZoneEdit : formMode === 'edit-container' ? submitContainerEdit : formMode === 'icon' ? submitAreaIcon : submitContainer}>
              {formMode !== 'icon' ? <label>Name<input autoFocus defaultValue={formMode === 'edit-zone' ? selectedZone?.name : formMode === 'edit-container' ? selectedContainer?.name : ''} name="name" placeholder={formMode === 'area' ? 'Garage' : formMode === 'zone' || formMode === 'edit-zone' ? 'North wall' : 'Camping bin'} required /></label> : null}
              {formMode === 'area' || formMode === 'icon' ? <AreaIconPicker defaultValue={formMode === 'icon' ? selectedArea?.icon : undefined} /> : null}
              {formMode === 'container' || formMode === 'edit-container' ? <>
                <div className="form-row">
                  {formMode === 'edit-container' ? <label>Type<input className="readonly-input" readOnly value={CONTAINER_TYPES.find((type) => type.value === selectedContainer?.container_type)?.label ?? 'Other'} /></label> : <label>Type<select defaultValue="bin" name="containerType">{CONTAINER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>}
                  {formMode === 'edit-container' ? <label>Code<input className="readonly-input" readOnly value={selectedContainer?.code ?? ''} /></label> : <div className="generated-code-note"><QrCode aria-hidden="true" /><span><strong>Code generated automatically</strong><small>Based on the selected container type</small></span></div>}
                </div>
                <fieldset className="identifier-picker">
                  <legend>Physical identifier</legend>
                  {([
                    { value: 'qr', label: 'QR code', description: 'Print and scan a label', icon: QrCode },
                    { value: 'nfc', label: 'NFC tag', description: 'Tap with a compatible phone', icon: Radio },
                    { value: 'both', label: 'Both', description: 'Use QR and NFC together', icon: QrCode },
                    { value: 'none', label: 'Neither', description: 'No physical tag', icon: CircleOff },
                  ] as const).map((option) => {
                    const Icon = option.icon
                    return (
                      <label key={option.value}>
                        <input defaultChecked={(selectedContainer?.identifier_type ?? 'none') === option.value} name="identifierType" type="radio" value={option.value} />
                        <span><span className="identifier-option-icons"><Icon aria-hidden="true" />{option.value === 'both' ? <Radio aria-hidden="true" /> : null}</span><span><strong>{option.label}</strong><small>{option.description}</small></span></span>
                      </label>
                    )
                  })}
                </fieldset>
                <label>Zone <span className="optional">Optional</span><select defaultValue={selectedContainer?.zone_id ?? ''} name="zoneId"><option value="">Directly in area</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
                <div className="form-row">
                  <label>Parent container <span className="optional">Optional</span><select defaultValue={selectedContainer ? placements.find((placement) => placement.container_id === selectedContainer.id)?.parent_container_id ?? '' : ''} name="parentId"><option value="">No parent</option>{containers.filter((container) => container.id !== selectedContainer?.id).map((container) => <option key={container.id} value={container.id}>{container.name}</option>)}</select></label>
                  <label>Relationship<select defaultValue={selectedContainer ? placements.find((placement) => placement.container_id === selectedContainer.id)?.relationship_type ?? 'in' : 'in'} name="relationshipType"><option value="in">In</option><option value="on">On</option><option value="under">Under</option><option value="attached_to">Attached to</option></select></label>
                </div>
                <label className="checkbox-label"><input defaultChecked={selectedContainer?.is_movable ?? true} name="isMovable" type="checkbox" /> This container can be moved</label>
              </> : null}
              {formMode !== 'icon' ? <label>Description <span className="optional">Optional</span><textarea defaultValue={formMode === 'edit-zone' ? selectedZone?.description ?? '' : formMode === 'edit-container' ? selectedContainer?.description ?? '' : ''} name="description" placeholder="Add a helpful note…" rows={3} /></label> : null}
              <div className="dialog-actions"><button className="secondary-action" onClick={() => { setFormMode(null); setSelectedZone(null); setSelectedContainer(null) }} type="button">Cancel</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving…' : formMode === 'area' ? 'Create area' : formMode === 'zone' ? 'Create zone' : formMode === 'edit-zone' || formMode === 'edit-container' ? 'Save changes' : formMode === 'icon' ? 'Save icon' : 'Create container'}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
