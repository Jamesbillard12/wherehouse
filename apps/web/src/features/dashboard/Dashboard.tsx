import {
  createPairingSession,
  listDevices,
  revokeDevice,
  type Device,
  type Household,
  type MeResponse,
  type PairingSession,
  subscribeToHousehold,
  type RealtimeStatus,
} from '@wherehouse/api-client'
import QRCode from 'qrcode'
import {
  Activity,
  ArrowRightLeft,
  Bell,
  Box,
  Camera,
  ChevronRight,
  Clock3,
  House,
  Laptop,
  MapPin,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Printer,
  QrCode,
  Search,
  Settings,
  Smartphone,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { ItemsView, itemLocation } from '../items/ItemsView'
import { CompanionReviewQueue } from '../items/CompanionReviewQueue'
import { AreaIcon, LocationsView } from '../locations/LocationsView'
import { formatDate, greeting } from '../../shared/utils/date'
import { message } from '../../shared/utils/errors'
import { SIDEBAR_KEY } from '../../shared/utils/storage'
import { type DashboardView, viewFromLocation } from '../../shared/utils/navigation'
import { useOverviewInventory } from './useOverviewInventory'

export function Dashboard({
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
  const [realtimeRevision, setRealtimeRevision] = useState(0)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting')
  const [reviewItemIds, setReviewItemIds] = useState<string[]>([])
  const [reviewQueueOpen, setReviewQueueOpen] = useState(false)
  const [resolvedTarget, setResolvedTarget] = useState<{ type: 'item' | 'container'; id: string; areaId?: string; scanKey: string } | null>(null)
  const overview = useOverviewInventory(household.id, token, realtimeRevision)

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(`wherehouse.review-queue.${household.id}`) ?? '[]') as string[]
    setReviewItemIds(stored)
    setReviewQueueOpen(stored.length > 0)
  }, [household.id])

  useEffect(() => subscribeToHousehold({
    householdId: household.id,
    token,
    onEvent: (event) => {
      if (event.type === 'identifier.resolved' && (event.entity === 'item' || event.entity === 'container')) {
        setResolvedTarget({ type: event.entity, id: event.entity_id, areaId: event.area_id, scanKey: event.occurred_at })
        navigate(event.entity === 'item' ? 'items' : 'locations')
        return
      }
      setRealtimeRevision((current) => current + 1)
      if (event.entity === 'item' && event.action === 'created' && event.source === 'device') {
        setReviewItemIds((current) => {
          const next = current.includes(event.entity_id) ? current : [...current, event.entity_id]
          localStorage.setItem(`wherehouse.review-queue.${household.id}`, JSON.stringify(next))
          return next
        })
        setReviewQueueOpen(true)
      }
    },
    onReady: () => setRealtimeRevision((current) => current + 1),
    onStatus: setRealtimeStatus,
  }), [household.id, token])

  function markReviewed(itemId: string) {
    setReviewItemIds((current) => {
      const next = current.filter((id) => id !== itemId)
      localStorage.setItem(`wherehouse.review-queue.${household.id}`, JSON.stringify(next))
      if (!next.length) setReviewQueueOpen(false)
      return next
    })
  }

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

  useEffect(() => { if (overview.error) setError(overview.error) }, [overview.error])

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
  const recentOverviewItems = [...overview.items]
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
        <span className="wordmark dark"><img alt="WhereHouse" className="brand-logo" src="/logo.png" /></span>
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
          <div className={`server-status ${realtimeStatus}`} title={`Realtime ${realtimeStatus}`}><i /><span>Realtime {realtimeStatus}</span></div>
        </div>
      </aside>

      <section className="dashboard-content">
        {activeView === 'items' ? (
          <ItemsView household={household} refreshKey={realtimeRevision} revealItemId={resolvedTarget?.type === 'item' ? resolvedTarget.id : undefined} revealScanKey={resolvedTarget?.type === 'item' ? resolvedTarget.scanKey : undefined} token={token} />
        ) : activeView === 'locations' ? (
          <LocationsView household={household} refreshKey={realtimeRevision} revealContainerAreaId={resolvedTarget?.type === 'container' ? resolvedTarget.areaId : undefined} revealContainerId={resolvedTarget?.type === 'container' ? resolvedTarget.id : undefined} revealScanKey={resolvedTarget?.type === 'container' ? resolvedTarget.scanKey : undefined} token={token} />
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
          <article><strong>{overview.loading ? '—' : overview.items.length}</strong><span>Items tracked</span></article>
          <article><strong>{overview.loading ? '—' : overview.containers.length}</strong><span>Containers</span></article>
          <article><strong>{overview.loading ? '—' : overview.areas.length}</strong><span>Areas</span></article>
          <article><strong>0</strong><span>Checked out</span></article>
        </div>

        <section className="overview-grid">
          <article className="overview-card">
            <div className="card-heading"><h2>Locations overview</h2><MapPin aria-hidden="true" /></div>
            {overview.areas.length ? <div className="overview-list">{overview.areas.slice(0, 3).map((area) => {
              const containerCount = overview.containers.filter((container) => container.area_id === area.id).length
              const zoneCount = overview.zones.filter((zone) => zone.area_id === area.id).length
              return <button key={area.id} onClick={() => navigate('locations')}><span className="area-icon"><AreaIcon name={area.icon} /></span><span><strong>{area.name}</strong><small>{zoneCount} zones · {containerCount} containers</small></span><ChevronRight aria-hidden="true" /></button>
            })}</div> : <><div className="empty-illustration"><House aria-hidden="true" /></div><strong>No locations yet</strong><p>Create an area such as a garage, attic, or trailer to begin organizing.</p></>}
            <a className="inline-link" href="/locations" onClick={(event) => { event.preventDefault(); navigate('locations') }}>View all locations →</a>
          </article>
          <article className="overview-card">
            <div className="card-heading"><h2>Recently added items</h2><Box aria-hidden="true" /></div>
            {recentOverviewItems.length ? <div className="overview-list item-preview-list">{recentOverviewItems.map((item) => {
              const placement = overview.itemPlacements.find((entry) => entry.item_id === item.id)
              return <button key={item.id} onClick={() => navigate('items')}><span className="area-icon"><Box aria-hidden="true" /></span><span><strong>{item.name}</strong><small>{itemLocation(placement, overview.areas, overview.zones, overview.containers, overview.containerPlacements)}</small></span><ChevronRight aria-hidden="true" /></button>
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
      {reviewItemIds.length && !reviewQueueOpen ? <button className="review-queue-launcher" onClick={() => setReviewQueueOpen(true)}><PackagePlus aria-hidden="true" /><span>{reviewItemIds.length}</span> Review companion items</button> : null}
      {reviewQueueOpen && reviewItemIds.length ? <CompanionReviewQueue inventory={overview} itemIds={reviewItemIds} onClose={() => setReviewQueueOpen(false)} onReviewed={markReviewed} onUpdated={() => setRealtimeRevision((current) => current + 1)} token={token} /> : null}
    </main>
  )
}
