import { type Household, type MeResponse, subscribeToHousehold, type RealtimeStatus } from '@wherehouse/api-client'
import {
  Activity,
  ArrowRightLeft,
  Bell,
  Box,
  Camera,
  ChevronRight,
  Clock3,
  House,
  MapPin,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Printer,
  Search,
  Settings,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

import { ItemsView, itemLocation } from '../items/ItemsView'
import { CompanionReviewQueue } from '../items/CompanionReviewQueue'
import { AreaIcon, LocationsView } from '../locations/LocationsView'
import { greeting } from '../../shared/utils/date'
import { SIDEBAR_KEY } from '../../shared/utils/storage'
import { type DashboardView, viewFromLocation } from '../../shared/utils/navigation'
import { useOverviewInventory } from './useOverviewInventory'
import { SettingsView } from '../settings/SettingsView'
import { settingsSectionFromLocation, type SettingsSection } from '../../shared/utils/navigation'

const sectionsForMenu: { id: SettingsSection; label: string }[] = [
  { id: 'account', label: 'Account' }, { id: 'households', label: 'Households' },
  { id: 'preferences', label: 'Preferences' }, { id: 'privacy', label: 'Data & Privacy' },
  { id: 'about', label: 'About' },
]

export function Dashboard({
  household,
  households,
  isOwner,
  onCreateHousehold,
  onSelect,
  onSignOut,
  token,
  user,
}: {
  household: Household
  households: Household[]
  isOwner: boolean
  onCreateHousehold: (name: string) => Promise<void>
  onSelect: (id: string) => void
  onSignOut: () => Promise<void>
  token: string
  user: MeResponse
}) {
  const [activeView, setActiveView] = useState<DashboardView>(viewFromLocation)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) === 'true',
  )
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>(settingsSectionFromLocation)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const [realtimeRevision, setRealtimeRevision] = useState(0)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting')
  const [reviewItemIds, setReviewItemIds] = useState<string[]>([])
  const [reviewQueueOpen, setReviewQueueOpen] = useState(false)
  const [resolvedTarget, setResolvedTarget] = useState<{ type: 'item' | 'container'; id: string; areaId?: string; scanKey: string } | null>(null)
  const [locationTarget, setLocationTarget] = useState<{ areaId: string; containerId?: string; zoneId?: string } | null>(null)
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
    if (!['/overview', '/items', '/locations'].includes(location.pathname) && !location.pathname.startsWith('/settings')) {
      history.replaceState({}, '', `/${activeView}`)
    }
    const handleNavigation = () => { setActiveView(viewFromLocation()); setSettingsSection(settingsSectionFromLocation()) }
    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  useEffect(() => {
    if (!accountMenuOpen) return
    const close = (event: MouseEvent) => { if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setAccountMenuOpen(false); accountMenuRef.current?.querySelector<HTMLButtonElement>('button')?.focus() } }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [accountMenuOpen])

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

  function navigateSettings(section: SettingsSection) {
    const destination = `/settings/${section}`
    history.pushState({}, '', destination)
    setSettingsSection(section)
    setActiveView('settings')
    setAccountMenuOpen(false)
  }

  function navigateToPairing() {
    history.pushState({}, '', '/settings/households#connected-devices')
    setSettingsSection('households')
    setActiveView('settings')
    setAccountMenuOpen(false)
    requestAnimationFrame(() => document.querySelector('#connected-devices')?.scrollIntoView())
  }

  const recentOverviewItems = [...overview.items]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 3)

  return (
    <main className={`dashboard ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="topbar">
        <span className="wordmark dark"><img alt="WhereHouse" className="brand-logo" src="/logo.png" /></span>
        <div className="global-search"><Search aria-hidden="true" /> <span>Search items, containers, locations</span></div>
        <div className="account-menu" ref={accountMenuRef}>
          <span className="topbar-icon"><Bell aria-hidden="true" /></span>
          <Button aria-expanded={accountMenuOpen} aria-haspopup="menu" aria-label="Open user menu" className="avatar avatar-button" onClick={() => setAccountMenuOpen((open) => !open)}>{user.user.display_name.slice(0, 1).toUpperCase()}</Button>
          {accountMenuOpen ? <div className="user-menu" role="menu"><div className="user-menu-identity"><strong>{user.user.display_name}</strong><span>{user.user.email}</span></div>{sectionsForMenu.map(({ id, label }) => <a href={`/settings/${id}`} key={id} onClick={(event) => { event.preventDefault(); navigateSettings(id) }} role="menuitem">{label}</a>)}{isOwner ? <a href="/settings/households#connected-devices" onClick={(event) => { event.preventDefault(); navigateToPairing() }} role="menuitem">Pair device</a> : null}<Button onClick={() => { setAccountMenuOpen(false); void onSignOut() }} role="menuitem"><UserRound aria-hidden="true" /> Sign out</Button></div> : null}
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-controls">
          <Button
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
          </Button>
        </div>
        <div className="sidebar-household">
          <p className="nav-label">Household</p>
          <select value={household.id} onChange={(event) => onSelect(event.target.value)}>
          {households.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </div>
        <nav>
          <a aria-label="Overview" className={`nav-item ${activeView === 'overview' ? 'active' : ''}`} href="/overview" onClick={(event) => { event.preventDefault(); navigate('overview') }} title="Overview"><House aria-hidden="true" /><span>Overview</span></a>
          <a aria-label="Locations" className={`nav-item ${activeView === 'locations' ? 'active' : ''}`} href="/locations" onClick={(event) => { event.preventDefault(); navigate('locations') }} title="Locations"><MapPin aria-hidden="true" /><span>Locations</span></a>
          <a aria-label="Items" className={`nav-item ${activeView === 'items' ? 'active' : ''}`} href="/items" onClick={(event) => { event.preventDefault(); navigate('items') }} title="Items"><Box aria-hidden="true" /><span>Items</span></a>
          <span aria-disabled="true" className="nav-item disabled" title="Activity"><Activity aria-hidden="true" /><span>Activity</span></span>
          <span aria-disabled="true" className="nav-item disabled" title="Transfers"><ArrowRightLeft aria-hidden="true" /><span>Transfers</span></span>
          <span aria-disabled="true" className="nav-item disabled" title="Checkouts"><Clock3 aria-hidden="true" /><span>Checkouts</span></span>
          <a aria-label="Settings" className={`nav-item ${activeView === 'settings' ? 'active' : ''}`} href="/settings/account" onClick={(event) => { event.preventDefault(); navigateSettings('account') }} title="Settings"><Settings aria-hidden="true" /><span>Settings</span></a>
        </nav>
        <div className="sidebar-footer">
          <div className={`server-status ${realtimeStatus}`} title={`Realtime ${realtimeStatus}`}><i /><span>Realtime {realtimeStatus}</span></div>
        </div>
      </aside>

      <section className={`dashboard-content ${activeView === 'overview' ? 'overview-content' : ''}`}>
        {activeView === 'items' ? (
          <ItemsView household={household} onOpenLocation={(target) => { setLocationTarget(target); navigate('locations') }} onRevealConsumed={() => setResolvedTarget(null)} refreshKey={realtimeRevision} revealItemId={resolvedTarget?.type === 'item' ? resolvedTarget.id : undefined} revealScanKey={resolvedTarget?.type === 'item' ? resolvedTarget.scanKey : undefined} token={token} />
        ) : activeView === 'locations' ? (
          <LocationsView household={household} onRevealConsumed={() => { setResolvedTarget(null); setLocationTarget(null) }} refreshKey={realtimeRevision} revealAreaId={locationTarget?.areaId ?? (resolvedTarget?.type === 'container' ? resolvedTarget.areaId : undefined)} revealContainerId={locationTarget?.containerId ?? (resolvedTarget?.type === 'container' ? resolvedTarget.id : undefined)} revealScanKey={resolvedTarget?.type === 'container' ? resolvedTarget.scanKey : undefined} revealZoneId={locationTarget?.zoneId} token={token} />
        ) : activeView === 'settings' ? (
          <SettingsView household={household} households={households} isOwner={isOwner} onCreateHousehold={onCreateHousehold} onNavigate={navigateSettings} onSelect={onSelect} section={settingsSection} token={token} user={user} />
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
              return <a href="/locations" key={area.id} onClick={(event) => { event.preventDefault(); setLocationTarget({ areaId: area.id }); navigate('locations') }}><span className="area-icon"><AreaIcon name={area.icon} /></span><span><strong>{area.name}</strong><small>{zoneCount} zones · {containerCount} containers</small></span><ChevronRight aria-hidden="true" /></a>
            })}</div> : <><div className="empty-illustration"><House aria-hidden="true" /></div><strong>No locations yet</strong><p>Create an area such as a garage, attic, or trailer to begin organizing.</p></>}
            <a className="inline-link" href="/locations" onClick={(event) => { event.preventDefault(); navigate('locations') }}>View all locations →</a>
          </article>
          <article className="overview-card">
            <div className="card-heading"><h2>Recently added items</h2><Box aria-hidden="true" /></div>
            {recentOverviewItems.length ? <div className="overview-list item-preview-list">{recentOverviewItems.map((item) => {
              const placement = overview.itemPlacements.find((entry) => entry.item_id === item.id)
              return <a href={`/items#${item.id}`} key={item.id} onClick={(event) => { event.preventDefault(); setResolvedTarget({ type: 'item', id: item.id, scanKey: `overview-${item.id}` }); navigate('items') }}><span className="area-icon"><Box aria-hidden="true" /></span><span><strong>{item.name}</strong><small>{itemLocation(placement, overview.areas, overview.zones, overview.containers, overview.containerPlacements)}</small></span><ChevronRight aria-hidden="true" /></a>
            })}</div> : <><div className="empty-illustration"><PackagePlus aria-hidden="true" /></div><strong>Your inventory is ready</strong><p>Items you add will appear here with their exact location path.</p></>}
            <a className="inline-link" href="/items" onClick={(event) => { event.preventDefault(); navigate('items') }}>View all items →</a>
          </article>
          <article className="overview-card">
            <div className="card-heading"><h2>Recent activity</h2><Activity aria-hidden="true" /></div>
            <div className="empty-illustration"><Clock3 aria-hidden="true" /></div>
            <strong>No activity yet</strong>
            <p>Additions, moves, checkouts, and returns will be recorded here.</p>
            <Button className="inline-link" disabled>View all activity →</Button>
          </article>
        </section>

        <section className="quick-grid">
          <article><div className="quick-icon"><ArrowRightLeft aria-hidden="true" /></div><div><strong>Transfer items</strong><span>Move inventory between locations.</span></div><small>Coming next</small></article>
          <article><div className="quick-icon"><Camera aria-hidden="true" /></div><div><strong>AI item capture</strong><span>Photograph an item and review suggestions.</span></div><small>Coming next</small></article>
          <article><div className="quick-icon"><Printer aria-hidden="true" /></div><div><strong>Print labels</strong><span>Create QR labels for items and containers.</span></div><small>Coming next</small></article>
        </section>

        </>
        )}
      </section>
      {reviewItemIds.length && !reviewQueueOpen ? <Button className="review-queue-launcher" onClick={() => setReviewQueueOpen(true)}><PackagePlus aria-hidden="true" /><span>{reviewItemIds.length}</span> Review companion items</Button> : null}
      {reviewQueueOpen && reviewItemIds.length ? <CompanionReviewQueue inventory={overview} itemIds={reviewItemIds} onClose={() => setReviewQueueOpen(false)} onReviewed={markReviewed} onUpdated={() => setRealtimeRevision((current) => current + 1)} token={token} /> : null}
    </main>
  )
}
