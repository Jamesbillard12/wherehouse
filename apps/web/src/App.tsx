import {
  createArea,
  createContainer,
  createHousehold,
  createItem,
  createPairingSession,
  createZone,
  deleteArea,
  deleteContainer,
  getMe,
  getItemImage,
  listAreas,
  listContainerPlacements,
  listContainers,
  listDevices,
  listHouseholds,
  listItemPlacements,
  listItems,
  listZones,
  login,
  logout,
  placeContainer,
  placeItem,
  register,
  removeContainerPlacement,
  revokeDevice,
  setContainerSpace,
  updateAreaIcon,
  updateContainer,
  updateZone,
  uploadItemImage,
  type Area,
  type ContainerPlacement,
  type ContainerType,
  type Device,
  type Household,
  type Item,
  type ItemPlacement,
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
  Image as ImageIcon,
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

type DashboardView = 'overview' | 'items' | 'locations'

function viewFromLocation(): DashboardView {
  if (location.pathname === '/items') return 'items'
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
  const [overviewAreas, setOverviewAreas] = useState<Area[]>([])
  const [overviewZones, setOverviewZones] = useState<Zone[]>([])
  const [overviewContainers, setOverviewContainers] = useState<StorageContainer[]>([])
  const [overviewContainerPlacements, setOverviewContainerPlacements] = useState<ContainerPlacement[]>([])
  const [overviewItems, setOverviewItems] = useState<Item[]>([])
  const [overviewItemPlacements, setOverviewItemPlacements] = useState<ItemPlacement[]>([])
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [pairing, setPairing] = useState<PairingSession | null>(null)
  const [pairingDeviceBaseline, setPairingDeviceBaseline] = useState(0)
  const [qrCode, setQrCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!['/overview', '/items', '/locations'].includes(location.pathname)) {
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
    let cancelled = false
    setOverviewLoading(true)
    async function loadOverview() {
      const [nextAreas, nextItems, nextItemPlacements] = await Promise.all([
        listAreas(token, household.id),
        listItems(token, household.id),
        listItemPlacements(token, household.id),
      ])
      const details = await Promise.all(nextAreas.map(async (area) => {
        const [areaZones, areaContainers, areaPlacements] = await Promise.all([
          listZones(token, area.id),
          listContainers(token, area.id),
          listContainerPlacements(token, area.id),
        ])
        return { areaZones, areaContainers, areaPlacements }
      }))
      if (cancelled) return
      setOverviewAreas(nextAreas)
      setOverviewItems(nextItems)
      setOverviewItemPlacements(nextItemPlacements)
      setOverviewZones(details.flatMap((detail) => detail.areaZones))
      setOverviewContainers(details.flatMap((detail) => detail.areaContainers))
      setOverviewContainerPlacements(details.flatMap((detail) => detail.areaPlacements))
    }
    void loadOverview()
      .catch((reason) => !cancelled && setError(message(reason)))
      .finally(() => !cancelled && setOverviewLoading(false))
    return () => { cancelled = true }
  }, [household.id, token])

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
  const recentOverviewItems = [...overviewItems]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 3)

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
          <a aria-label="Items" className={`nav-item ${activeView === 'items' ? 'active' : ''}`} href="/items" onClick={(event) => { event.preventDefault(); navigate('items') }} title="Items"><Box aria-hidden="true" /><span>Items</span></a>
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
        {activeView === 'items' ? (
          <ItemsView household={household} token={token} />
        ) : activeView === 'locations' ? (
          <LocationsView household={household} token={token} />
        ) : (
        <>
        <div className="page-heading" id="overview">
          <div>
            <p className="eyebrow">{household.name}</p>
            <h1>{greeting()}, {user.user.display_name.split(' ')[0]} <span className="wave">👋</span></h1>
          </div>
          <a className="primary-button compact overview-add" href="/items" onClick={(event) => { event.preventDefault(); navigate('items') }}><Plus aria-hidden="true" /> Add item</a>
        </div>

        <div className="stat-grid">
          <article><strong>{overviewLoading ? '—' : overviewItems.length}</strong><span>Items tracked</span></article>
          <article><strong>{overviewLoading ? '—' : overviewContainers.length}</strong><span>Containers</span></article>
          <article><strong>{overviewLoading ? '—' : overviewAreas.length}</strong><span>Areas</span></article>
          <article><strong>0</strong><span>Checked out</span></article>
        </div>

        <section className="overview-grid">
          <article className="overview-card">
            <div className="card-heading"><h2>Locations overview</h2><MapPin aria-hidden="true" /></div>
            {overviewAreas.length ? <div className="overview-list">{overviewAreas.slice(0, 3).map((area) => {
              const containerCount = overviewContainers.filter((container) => container.area_id === area.id).length
              const zoneCount = overviewZones.filter((zone) => zone.area_id === area.id).length
              return <button key={area.id} onClick={() => navigate('locations')}><span className="area-icon"><AreaIcon name={area.icon} /></span><span><strong>{area.name}</strong><small>{zoneCount} zones · {containerCount} containers</small></span><ChevronRight aria-hidden="true" /></button>
            })}</div> : <><div className="empty-illustration"><House aria-hidden="true" /></div><strong>No locations yet</strong><p>Create an area such as a garage, attic, or trailer to begin organizing.</p></>}
            <a className="inline-link" href="/locations" onClick={(event) => { event.preventDefault(); navigate('locations') }}>View all locations →</a>
          </article>
          <article className="overview-card">
            <div className="card-heading"><h2>Recently added items</h2><Box aria-hidden="true" /></div>
            {recentOverviewItems.length ? <div className="overview-list item-preview-list">{recentOverviewItems.map((item) => {
              const placement = overviewItemPlacements.find((entry) => entry.item_id === item.id)
              return <button key={item.id} onClick={() => navigate('items')}><span className="area-icon"><Box aria-hidden="true" /></span><span><strong>{item.name}</strong><small>{itemLocation(placement, overviewAreas, overviewZones, overviewContainers, overviewContainerPlacements)}</small></span><ChevronRight aria-hidden="true" /></button>
            })}</div> : <><div className="empty-illustration"><PackagePlus aria-hidden="true" /></div><strong>Your inventory is ready</strong><p>Items you add will appear here with their exact location path.</p></>}
            <a className="inline-link" href="/items" onClick={(event) => { event.preventDefault(); navigate('items') }}>View all items →</a>
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

function itemLocation(
  placement: ItemPlacement | undefined,
  areas: Area[],
  zones: Zone[],
  containers: StorageContainer[],
  containerPlacements: ContainerPlacement[],
): string {
  if (!placement) return 'Unplaced'
  if (placement.area_id) return areas.find((area) => area.id === placement.area_id)?.name ?? 'Area'
  if (placement.zone_id) {
    const zone = zones.find((entry) => entry.id === placement.zone_id)
    const area = areas.find((entry) => entry.id === zone?.area_id)
    return [area?.name, zone?.name].filter(Boolean).join(' / ')
  }
  const path: string[] = []
  let container = containers.find((entry) => entry.id === placement.container_id)
  const area = areas.find((entry) => entry.id === container?.area_id)
  const zone = zones.find((entry) => entry.id === container?.zone_id)
  while (container) {
    path.unshift(container.name)
    const parentId = containerPlacements.find((entry) => entry.container_id === container?.id)?.parent_container_id
    container = containers.find((entry) => entry.id === parentId)
  }
  return [area?.name, zone?.name, ...path].filter(Boolean).join(' / ') || 'Unplaced'
}

function ItemDetailsModal({ item, locationLabel, onClose, onUpdated, token }: { item: Item; locationLabel: string; onClose: () => void; onUpdated: (item: Item) => void; token: string }) {
  const [imageUrl, setImageUrl] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  useEffect(() => {
    if (!item.image_path) {
      setImageUrl('')
      return
    }
    let active = true
    let objectUrl = ''
    void getItemImage(token, item.id).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setImageUrl(objectUrl)
    }).catch((reason) => active && setImageError(message(reason)))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [item.id, item.image_path, token])

  async function changeImage(file: File | undefined) {
    if (!file) return
    setImageBusy(true)
    setImageError(null)
    try {
      const updated = await uploadItemImage(token, item.id, file)
      onUpdated(updated)
    } catch (reason) {
      setImageError(message(reason))
    } finally {
      setImageBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="item-details-title" aria-modal="true" className="location-dialog item-details-dialog" role="dialog">
        <div className="dialog-heading">
          <div><p className="eyebrow">Item details</p><h2 id="item-details-title">{item.name}</h2></div>
          <button aria-label="Close item details" onClick={onClose}>×</button>
        </div>
        <div className="item-image-panel">
          {imageUrl ? <img alt={item.name} src={imageUrl} /> : <div className="item-image-placeholder"><ImageIcon aria-hidden="true" /><strong>No image yet</strong><span>Add a photo to make this item easier to identify.</span></div>}
          <label className="item-image-action"><Camera aria-hidden="true" /><span>{imageBusy ? 'Uploading…' : imageUrl ? 'Replace image' : 'Add image'}</span><input accept="image/jpeg,image/png,image/webp" disabled={imageBusy} onChange={(event) => { void changeImage(event.target.files?.[0]); event.target.value = '' }} type="file" /></label>
        </div>
        {imageError ? <div className="alert">{imageError}</div> : null}
        <div className="item-detail-location"><MapPin aria-hidden="true" /><span><small>Location</small><strong>{locationLabel}</strong></span></div>
        <dl className="item-detail-grid">
          <div><dt>Quantity</dt><dd>{Number(item.quantity)}{item.unit ? ` ${item.unit}` : ''}</dd></div>
          <div><dt>Manufacturer</dt><dd>{item.manufacturer || '—'}</dd></div>
          <div><dt>Model</dt><dd>{item.model || '—'}</dd></div>
          <div><dt>Serial number</dt><dd>{item.serial_number || '—'}</dd></div>
          <div><dt>Added</dt><dd>{formatDate(item.created_at)}</dd></div>
          <div><dt>Last updated</dt><dd>{formatDate(item.updated_at)}</dd></div>
        </dl>
        {item.description ? <div className="item-detail-copy"><strong>Description</strong><p>{item.description}</p></div> : null}
        {item.notes ? <div className="item-detail-copy"><strong>Notes</strong><p>{item.notes}</p></div> : null}
        <div className="dialog-actions"><button className="secondary-action" onClick={onClose}>Close</button></div>
      </section>
    </div>
  )
}

function ItemsView({ household, token }: { household: Household; token: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [placements, setPlacements] = useState<ItemPlacement[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [containers, setContainers] = useState<StorageContainer[]>([])
  const [containerPlacements, setContainerPlacements] = useState<ContainerPlacement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadInventory() {
    const [nextItems, nextPlacements, nextAreas] = await Promise.all([
      listItems(token, household.id),
      listItemPlacements(token, household.id),
      listAreas(token, household.id),
    ])
    const details = await Promise.all(nextAreas.map(async (area) => {
      const [areaZones, areaContainers, areaPlacements] = await Promise.all([
        listZones(token, area.id),
        listContainers(token, area.id),
        listContainerPlacements(token, area.id),
      ])
      return { areaZones, areaContainers, areaPlacements }
    }))
    setItems(nextItems)
    setPlacements(nextPlacements)
    setAreas(nextAreas)
    setZones(details.flatMap((detail) => detail.areaZones))
    setContainers(details.flatMap((detail) => detail.areaContainers))
    setContainerPlacements(details.flatMap((detail) => detail.areaPlacements))
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    void loadInventory().catch((reason) => setError(message(reason))).finally(() => setLoading(false))
  }, [household.id, token])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const item = await createItem(token, household.id, {
        name: String(data.get('name')).trim(),
        description: String(data.get('description')).trim() || undefined,
        quantity: Number(data.get('quantity')),
        unit: String(data.get('unit')).trim() || undefined,
        manufacturer: String(data.get('manufacturer')).trim() || undefined,
        model: String(data.get('model')).trim() || undefined,
      })
      const target = String(data.get('placement'))
      if (target) {
        const [targetType, targetId] = target.split(':')
        await placeItem(token, item.id, {
          [`${targetType}_id`]: targetId,
          ...(targetType === 'container' ? { relationship_type: 'in' as const } : {}),
        })
      }
      await loadInventory()
      setShowForm(false)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="items-view">
      <div className="page-heading locations-heading"><div><p className="eyebrow">Household inventory</p><h1>Items</h1><p className="page-description">Everything you track, with its exact storage path.</p></div><button className="primary-button compact" onClick={() => setShowForm(true)}><Plus aria-hidden="true" /> Add item</button></div>
      {error ? <div className="alert locations-alert">{error}</div> : null}
      <section className="items-panel">
        {loading ? <div className="locations-loading">Loading items…</div> : items.length ? (
          <table className="items-table">
            <thead><tr><th>Item</th><th>Quantity</th><th>Location</th><th>Details</th></tr></thead>
            <tbody>{items.map((item) => {
              const placement = placements.find((entry) => entry.item_id === item.id)
              return <tr key={item.id}><td><button className="item-details-button" onClick={() => setSelectedItem(item)}><strong>{item.name}</strong>{item.description ? <small>{item.description}</small> : null}</button></td><td>{Number(item.quantity)}{item.unit ? ` ${item.unit}` : ''}</td><td><span className={placement ? 'location-path' : 'unplaced-badge'}>{itemLocation(placement, areas, zones, containers, containerPlacements)}</span></td><td>{[item.manufacturer, item.model].filter(Boolean).join(' · ') || '—'}</td></tr>
            })}</tbody>
          </table>
        ) : <div className="location-empty"><div className="empty-illustration"><PackagePlus aria-hidden="true" /></div><strong>No items yet</strong><p>Add your first item and place it directly in an area, zone, or container.</p><button className="primary-button compact" onClick={() => setShowForm(true)}><Plus aria-hidden="true" /> Add first item</button></div>}
      </section>
      {selectedItem ? <ItemDetailsModal item={selectedItem} locationLabel={itemLocation(placements.find((entry) => entry.item_id === selectedItem.id), areas, zones, containers, containerPlacements)} onClose={() => setSelectedItem(null)} onUpdated={(updated) => { setSelectedItem(updated); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)) }} token={token} /> : null}
      {showForm ? <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}><section aria-labelledby="item-dialog-title" aria-modal="true" className="location-dialog" role="dialog"><div className="dialog-heading"><div><p className="eyebrow">Inventory</p><h2 id="item-dialog-title">Add an item</h2></div><button aria-label="Close" onClick={() => setShowForm(false)}>×</button></div><form onSubmit={submit}>
        <label>Name<input autoFocus name="name" placeholder="Cordless drill" required /></label>
        <div className="form-row"><label>Quantity<input defaultValue="1" min="0.001" name="quantity" required step="0.001" type="number" /></label><label>Unit <span className="optional">Optional</span><input name="unit" placeholder="pieces, boxes, feet" /></label></div>
        <div className="form-row"><label>Manufacturer <span className="optional">Optional</span><input name="manufacturer" /></label><label>Model <span className="optional">Optional</span><input name="model" /></label></div>
        <label>Location <span className="optional">Optional</span><select defaultValue="" name="placement"><option value="">Unplaced</option>{areas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}{zones.map((zone) => <option key={zone.id} value={`zone:${zone.id}`}>{areas.find((area) => area.id === zone.area_id)?.name} / {zone.name}</option>)}{containers.map((container) => <option key={container.id} value={`container:${container.id}`}>{itemLocation({ id: '', item_id: '', area_id: null, zone_id: null, container_id: container.id, relationship_type: 'in', created_at: '', updated_at: '' }, areas, zones, containers, containerPlacements)}</option>)}</select></label>
        <label>Description <span className="optional">Optional</span><textarea name="description" rows={3} /></label>
        <div className="dialog-actions"><button className="secondary-action" onClick={() => setShowForm(false)} type="button">Cancel</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Create item'}</button></div>
      </form></section></div> : null}
    </div>
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
  const [items, setItems] = useState<Item[]>([])
  const [itemPlacements, setItemPlacements] = useState<ItemPlacement[]>([])
  const [openContainerId, setOpenContainerId] = useState<string | null>(null)
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [formMode, setFormMode] = useState<'area' | 'zone' | 'edit-zone' | 'container' | 'edit-container' | 'icon' | null>(null)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [selectedContainer, setSelectedContainer] = useState<StorageContainer | null>(null)
  const [selectedDetailItem, setSelectedDetailItem] = useState<Item | null>(null)
  const [showNestedItemForm, setShowNestedItemForm] = useState(false)
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
    const [nextZones, nextContainers, nextPlacements, nextItems, nextItemPlacements] = await Promise.all([
      listZones(token, areaId),
      listContainers(token, areaId),
      listContainerPlacements(token, areaId),
      listItems(token, household.id),
      listItemPlacements(token, household.id),
    ])
    setZones(nextZones)
    setContainers(nextContainers)
    setPlacements(nextPlacements)
    setItems(nextItems)
    setItemPlacements(nextItemPlacements)
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
    setOpenContainerId(null)
    setSelectedZoneFilter('')
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

  async function submitNestedItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!openContainerId) return
    setSaving(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      const item = await createItem(token, household.id, {
        name: String(data.get('name')).trim(),
        description: String(data.get('description')).trim() || undefined,
        quantity: Number(data.get('quantity')),
        unit: String(data.get('unit')).trim() || undefined,
      })
      await placeItem(token, item.id, {
        container_id: openContainerId,
        relationship_type: 'in',
      })
      await loadAreaDetails(selectedAreaId)
      setShowNestedItemForm(false)
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }

  const selectedArea = areas.find((area) => area.id === selectedAreaId)
  const placementByContainer = new Map(placements.map((placement) => [placement.container_id, placement]))
  const containerById = new Map(containers.map((container) => [container.id, container]))
  const openContainer = openContainerId ? containerById.get(openContainerId) : null
  const openContainerTrail: StorageContainer[] = []
  let trailCursor = openContainer
  while (trailCursor) {
    openContainerTrail.unshift(trailCursor)
    const parentId = placementByContainer.get(trailCursor.id)?.parent_container_id
    trailCursor = parentId ? containerById.get(parentId) : undefined
  }
  const visibleContainers = containers.filter((container) => {
    const parentId = placementByContainer.get(container.id)?.parent_container_id
    return openContainerId
      ? parentId === openContainerId
      : !parentId && (!selectedZoneFilter || container.zone_id === selectedZoneFilter)
  })
  const visibleItems = items.filter((item) => {
    const placement = itemPlacements.find((entry) => entry.item_id === item.id)
    if (!placement) return false
    if (openContainerId) return placement.container_id === openContainerId
    if (selectedZoneFilter) return placement.zone_id === selectedZoneFilter
    return placement.area_id === selectedAreaId || zones.some((zone) => zone.id === placement.zone_id)
  })

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
                <button className={`zone-filter ${selectedZoneFilter === '' ? 'selected' : ''}`} onClick={() => { setSelectedZoneFilter(''); setOpenContainerId(null) }}>All</button>
                {zones.map((zone) => <span className={`zone-chip ${selectedZoneFilter === zone.id ? 'selected' : ''}`} key={zone.id}><button className="zone-filter-name" onClick={() => { setSelectedZoneFilter(zone.id); setOpenContainerId(null) }}>{zone.name}</button><button aria-label={`Edit ${zone.name}`} onClick={() => editZone(zone)} title={`Edit ${zone.name}`}><Pencil aria-hidden="true" /></button></span>)}
                <button onClick={() => setFormMode('zone')}><Plus aria-hidden="true" /> Add zone</button>
              </div>
            ) : <div className="empty-strip"><span><MapPin aria-hidden="true" /> No zones yet. Add one to describe a shelf wall, workbench, or other section.</span><button onClick={() => setFormMode('zone')}><Plus aria-hidden="true" /> Add zone</button></div>}

            {openContainer ? <div className="container-breadcrumb"><button className="back-button" onClick={() => setOpenContainerId(placementByContainer.get(openContainer.id)?.parent_container_id ?? null)}>← Back</button><nav aria-label="Container location" className="container-path">{openContainerTrail.map((container, index) => <span className="path-segment" key={container.id}>{index ? <ChevronRight aria-hidden="true" /> : null}{index < openContainerTrail.length - 1 ? <button onClick={() => setOpenContainerId(container.id)}>{container.name}</button> : <strong>{container.name}</strong>}</span>)}</nav><small>{openContainer.code}</small><div className="nested-actions"><button className="add-nested-button" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add container</button><button className="add-nested-button" onClick={() => setShowNestedItemForm(true)}><Plus aria-hidden="true" /> Add item</button></div></div> : null}

            {visibleContainers.length || visibleItems.length ? (
              <div className="container-list">
                {visibleContainers.map((container) => {
                  const placement = placementByContainer.get(container.id)
                  const parent = placement ? containerById.get(placement.parent_container_id) : null
                  const zone = zones.find((entry) => entry.id === container.zone_id)
                  return (
                    <article key={container.id}>
                      <div className="container-icon"><Container aria-hidden="true" /></div>
                      <button className="container-copy container-open" onClick={() => setOpenContainerId(container.id)}>
                        <div><strong>{container.name}</strong><span className="type-badge">{container.container_type.replace('_', ' ')}</span>{container.identifier_type !== 'none' ? <span className="identifier-badge">{container.identifier_type !== 'nfc' ? <QrCode aria-hidden="true" /> : null}{container.identifier_type !== 'qr' ? <Radio aria-hidden="true" /> : null}{container.identifier_type === 'both' ? 'QR + NFC' : container.identifier_type.toUpperCase()}</span> : null}{container.is_out_of_space ? <span className="full-badge">Full</span> : null}</div>
                        <span>{[zone?.name, parent ? `${placement?.relationship_type.replace('_', ' ')} ${parent.name}` : null, container.code].filter(Boolean).join(' · ') || 'Directly in area'}</span>
                      </button>
                      <div className="container-actions"><button aria-label={`Edit ${container.name}`} className="edit-container-button" onClick={() => editContainer(container)} title={`Edit ${container.name}`}><Pencil aria-hidden="true" /></button><button aria-label={`Delete ${container.name}`} className="delete-container-button" disabled={saving} onClick={() => void removeContainer(container)} title={`Delete ${container.name}`}><Trash2 aria-hidden="true" /></button><button className="space-button" onClick={() => void toggleSpace(container)}>{container.is_out_of_space ? 'Mark available' : 'Mark full'}</button></div>
                    </article>
                  )
                })}
                {visibleItems.map((item) => <article className="location-item-row" key={item.id}><div className="container-icon"><Box aria-hidden="true" /></div><button className="container-copy container-open" onClick={() => setSelectedDetailItem(item)}><div><strong>{item.name}</strong><span className="type-badge">Item</span></div><span>{Number(item.quantity)}{item.unit ? ` ${item.unit}` : ''}{item.description ? ` · ${item.description}` : ''}</span></button><ChevronRight aria-hidden="true" /></article>)}
              </div>
            ) : (
              <div className="location-empty"><div className="empty-illustration"><Container aria-hidden="true" /></div><strong>{openContainer ? `${openContainer.name} is empty` : `No containers in ${selectedArea?.name}`}</strong><p>{openContainer ? 'Add a nested container or place items here.' : 'Add a shelf, cabinet, bin, or any other place that can hold household items.'}</p>{openContainer ? <div className="empty-actions"><button className="secondary-action" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add nested container</button><button className="primary-button compact" onClick={() => setShowNestedItemForm(true)}><Plus aria-hidden="true" /> Add item</button></div> : <button className="primary-button compact" onClick={() => setFormMode('container')}><Plus aria-hidden="true" /> Add first container</button>}</div>
            )}
          </section>
        </div>
      ) : (
        <div className="location-empty first-area"><div className="empty-illustration"><Warehouse aria-hidden="true" /></div><strong>Create your first area</strong><p>Start with a major physical location such as a garage, attic, shed, trailer, or workshop.</p><button className="primary-button compact" onClick={() => setFormMode('area')}><Plus aria-hidden="true" /> Add area</button></div>
      )}

      {selectedDetailItem ? <ItemDetailsModal item={selectedDetailItem} locationLabel={itemLocation(itemPlacements.find((entry) => entry.item_id === selectedDetailItem.id), areas, zones, containers, placements)} onClose={() => setSelectedDetailItem(null)} onUpdated={(updated) => { setSelectedDetailItem(updated); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)) }} token={token} /> : null}

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
                  <label>Parent container <span className="optional">Optional</span><select defaultValue={selectedContainer ? placements.find((placement) => placement.container_id === selectedContainer.id)?.parent_container_id ?? '' : openContainerId ?? ''} name="parentId"><option value="">No parent</option>{containers.filter((container) => container.id !== selectedContainer?.id).map((container) => <option key={container.id} value={container.id}>{container.name}</option>)}</select></label>
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
      {showNestedItemForm && openContainer ? <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowNestedItemForm(false)}><section aria-labelledby="nested-item-dialog-title" aria-modal="true" className="location-dialog" role="dialog"><div className="dialog-heading"><div><p className="eyebrow">Add to {openContainer.name}</p><h2 id="nested-item-dialog-title">Add an item</h2></div><button aria-label="Close" onClick={() => setShowNestedItemForm(false)}>×</button></div><form onSubmit={submitNestedItem}>
        <label>Name<input autoFocus name="name" placeholder="Cordless drill" required /></label>
        <div className="form-row"><label>Quantity<input defaultValue="1" min="0.001" name="quantity" required step="0.001" type="number" /></label><label>Unit <span className="optional">Optional</span><input name="unit" placeholder="pieces, boxes, feet" /></label></div>
        <label>Description <span className="optional">Optional</span><textarea name="description" rows={3} /></label>
        <div className="placement-summary"><Container aria-hidden="true" /><span><strong>Placed in {openContainer.name}</strong><small>{openContainer.code}</small></span></div>
        <div className="dialog-actions"><button className="secondary-action" onClick={() => setShowNestedItemForm(false)} type="button">Cancel</button><button className="primary-button" disabled={saving} type="submit">{saving ? 'Saving…' : 'Create item'}</button></div>
      </form></section></div> : null}
    </div>
  )
}
