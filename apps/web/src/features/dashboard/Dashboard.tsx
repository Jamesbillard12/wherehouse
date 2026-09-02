import { searchContainers, searchItems, type ContainerSearchResult, type Household, type Item, type ItemSearchResult, type MeResponse, subscribeToHousehold, type RealtimeStatus } from '@wherehouse/api-client'
import {
  Activity,
  ArrowRightLeft,
  Bell,
  Box,
  Container,
  Camera,
  ChevronRight,
  Clock3,
  House,
  MapPin,
  Package,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Printer,
  Search,
  Settings,
  UserRound,
} from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '../../components/wherehouse/PageHeader'

import { ItemDetailsModal, ItemsView, itemLocation } from '../items/ItemsView'
import { CompanionReviewQueue } from '../items/CompanionReviewQueue'
import { AreaIcon, LocationsView } from '../locations/LocationsView'
import { greeting } from '../../shared/utils/date'
import { SIDEBAR_KEY } from '../../shared/utils/storage'
import { type DashboardView, viewFromLocation } from '../../shared/utils/navigation'
import { useOverviewInventory } from './useOverviewInventory'
import { SettingsView } from '../settings/SettingsView'
import { FeatureActionsProvider, useFeatureActions } from '../app/FeatureActions'
import { GlobalFeatureHost } from '../app/GlobalFeatureHost'
import { settingsSectionFromLocation, type SettingsSection } from '../../shared/utils/navigation'

const sectionsForMenu: { id: SettingsSection; label: string }[] = [
  { id: 'account', label: 'Account' }, { id: 'households', label: 'Households' },
  { id: 'backups', label: 'Backup & Restore' }, { id: 'preferences', label: 'Preferences' }, { id: 'privacy', label: 'Data & Privacy' },
  { id: 'about', label: 'About' },
]

type SearchResult = ({ kind: 'item' } & ItemSearchResult) | ({ kind: 'container' } & ContainerSearchResult)
type SearchOption = SearchResult | { kind: 'setting'; id: SettingsSection; label: string }

const settingsSearchTerms: Record<SettingsSection, string> = {
  account: 'account profile display name email password',
  households: 'households household members devices pairing',
  backups: 'backup restore dropbox remote local external storage',
  preferences: 'preferences appearance theme',
  privacy: 'data privacy local storage',
  about: 'about version application',
}

export function Dashboard(props: Parameters<typeof DashboardContent>[0]) {
  return <FeatureActionsProvider><DashboardContent {...props} /></FeatureActionsProvider>
}

function DashboardContent({
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
  const quickCreateRef = useRef<HTMLDivElement>(null)
  const [realtimeRevision, setRealtimeRevision] = useState(0)
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting')
  const [reviewItemIds, setReviewItemIds] = useState<string[]>([])
  const [reviewQueueOpen, setReviewQueueOpen] = useState(false)
  const [resolvedTarget, setResolvedTarget] = useState<{ type: 'item' | 'container'; id: string; areaId?: string; containerId?: string; item?: Item; scanKey: string; zoneId?: string } | null>(null)
  const [locationTarget, setLocationTarget] = useState<{ areaId: string; containerId?: string; zoneId?: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [householdSelectOpen, setHouseholdSelectOpen] = useState(false)
  const [selectedOverviewItem, setSelectedOverviewItem] = useState<Item | null>(null)
  const overview = useOverviewInventory(household.id, token, realtimeRevision)
  const { actions: featureActions } = useFeatureActions()

  useEffect(() => {
    setSearchQuery('')
    setSearchResults([])
    setSearchError(false)
    setSelectedOverviewItem(null)
  }, [household.id])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) { setSearchResults([]); setSearchBusy(false); setSearchError(false); return }
    let cancelled = false
    setSearchBusy(true)
    setSearchError(false)
    const timer = window.setTimeout(() => void Promise.all([searchItems(token, household.id, query), searchContainers(token, household.id, query)])
      .then(([items, containers]) => { if (!cancelled) setSearchResults([...items.map((result) => ({ kind: 'item' as const, ...result })), ...containers.map((result) => ({ kind: 'container' as const, ...result }))]) })
      .catch(() => { if (!cancelled) { setSearchResults([]); setSearchError(true) } })
      .finally(() => { if (!cancelled) setSearchBusy(false) }), 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [household.id, searchQuery, token, realtimeRevision])

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
    if (!quickCreateOpen) return
    const close = (event: MouseEvent) => { if (!quickCreateRef.current?.contains(event.target as Node)) setQuickCreateOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setQuickCreateOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape) }
  }, [quickCreateOpen])

  function createLocation(type: 'area' | 'zone' | 'container') {
    setQuickCreateOpen(false)
    if (type === 'area') featureActions.createArea()
    else if (type === 'zone') featureActions.createZone({ areaId: overview.areas[0]?.id })
    else featureActions.createContainer({ areaId: overview.areas[0]?.id })
  }

  function createItemFromSidebar() {
    setQuickCreateOpen(false)
    featureActions.createItem()
  }

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

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const matchingSettings: SearchOption[] = normalizedSearchQuery
    ? sectionsForMenu.filter(({ id, label }) => `${label} ${settingsSearchTerms[id]}`.toLocaleLowerCase().includes(normalizedSearchQuery)).map(({ id, label }) => ({ kind: 'setting', id, label }))
    : []
  const visibleSearchResults: SearchOption[] = activeView === 'items'
    ? [...searchResults.filter((result) => result.kind === 'item'), ...matchingSettings]
    : activeView === 'locations'
      ? [...searchResults, ...matchingSettings]
      : activeView === 'settings'
        ? matchingSettings
        : [...searchResults, ...matchingSettings]

  function openSearchResult(result: SearchOption) {
    setSearchQuery('')
    if (result.kind === 'setting') {
      navigateSettings(result.id)
    } else if (result.kind === 'item') {
      const placement = overview.itemPlacements.find((entry) => entry.item_id === result.item.id)
      const container = overview.containers.find((entry) => entry.id === placement?.container_id)
      const zone = overview.zones.find((entry) => entry.id === placement?.zone_id)
      setResolvedTarget({ type: 'item', id: result.item.id, item: result.item, areaId: placement?.area_id ?? container?.area_id ?? zone?.area_id, containerId: placement?.container_id ?? undefined, zoneId: placement?.zone_id ?? undefined, scanKey: `search-${Date.now()}` })
      if (activeView !== 'items' && activeView !== 'locations') navigate('items')
    } else {
      setResolvedTarget({ type: 'container', id: result.container.id, areaId: result.container.area_id, scanKey: `search-${Date.now()}` })
      navigate('locations')
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (visibleSearchResults[0]) openSearchResult(visibleSearchResults[0])
    else navigate(activeView === 'items' ? 'items' : 'locations')
  }

  return (
    <main className={`dashboard ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="topbar">
        <div className="topbar-brand">
          <span className="wordmark dark"><img alt="WhereHouse" className="brand-logo" src="/logo.png" /></span>
          {householdSelectOpen ? (
            <Select items={households.map((option) => ({ label: option.name, value: option.id }))} onOpenChange={(open) => { if (!open) setHouseholdSelectOpen(false) }} onValueChange={(value) => { if (value && value !== household.id) onSelect(value); setHouseholdSelectOpen(false) }} open value={household.id}>
              <SelectTrigger aria-label="Select household" autoFocus className="topbar-household-select"><SelectValue /></SelectTrigger>
              <SelectContent align="start">{households.map((option) => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <div className="topbar-household"><span>{household.name}</span><Button aria-label="Change household" onClick={() => setHouseholdSelectOpen(true)} size="icon-sm" title="Change household" variant="ghost"><Pencil aria-hidden="true" /></Button></div>
          )}
        </div>
        <form className="global-search" onSubmit={submitSearch}><Search aria-hidden="true" /><Input aria-label="Search" className="global-search-input" maxLength={200} onChange={(event) => setSearchQuery(event.target.value)} placeholder={activeView === 'items' ? 'Search items and settings' : activeView === 'locations' ? 'Search items, containers, and settings' : activeView === 'settings' ? 'Search settings' : 'Search items, containers, and settings'} type="search" value={searchQuery} />{searchQuery ? <Button aria-label="Clear search" onClick={() => setSearchQuery('')} size="icon" type="button" variant="ghost">×</Button> : null}{searchQuery ? <div className="global-search-results" role="status">{searchBusy && activeView !== 'settings' ? <p>Searching…</p> : searchError && !matchingSettings.length ? <p>Search is unavailable. Try again.</p> : visibleSearchResults.length ? visibleSearchResults.map((result) => result.kind === 'item' ? <button key={`item-${result.item.id}`} onClick={() => openSearchResult(result)} type="button"><strong>{result.item.name}</strong><span>Item · {result.resolved_path ?? 'Unplaced'}{result.item.manufacturer ? ` · ${result.item.manufacturer}` : ''}</span></button> : result.kind === 'container' ? <button key={`container-${result.container.id}`} onClick={() => openSearchResult(result)} type="button"><strong>{result.container.name}</strong><span>Container · {result.resolved_path}</span></button> : <button key={`setting-${result.id}`} onClick={() => openSearchResult(result)} type="button"><strong>{result.label}</strong><span>Setting</span></button>) : <p>No matching results.</p>}</div> : null}</form>
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
        <div className="sidebar-create" ref={quickCreateRef}>
          <Button aria-expanded={quickCreateOpen} aria-haspopup="menu" aria-label="Create new" className="sidebar-create-button" onClick={() => setQuickCreateOpen((open) => !open)} title="Create new"><Plus aria-hidden="true" /></Button>
          {quickCreateOpen ? <div className="sidebar-create-menu" role="menu">
            <Button onClick={() => createLocation('area')} role="menuitem"><MapPin aria-hidden="true" /><span><strong>Area</strong><small>Add a major location</small></span></Button>
            <Button disabled={!overview.areas.length} onClick={() => createLocation('zone')} role="menuitem"><Package aria-hidden="true" /><span><strong>Zone</strong><small>{overview.areas.length ? 'Add to the selected area' : 'Create an area first'}</small></span></Button>
            <Button disabled={!overview.areas.length} onClick={() => createLocation('container')} role="menuitem"><Container aria-hidden="true" /><span><strong>Container</strong><small>{overview.areas.length ? 'Add storage' : 'Create an area first'}</small></span></Button>
            <Button onClick={createItemFromSidebar} role="menuitem"><Box aria-hidden="true" /><span><strong>Item</strong><small>Add inventory</small></span></Button>
            <Button onClick={() => { setQuickCreateOpen(false); navigateSettings('households') }} role="menuitem"><House aria-hidden="true" /><span><strong>Household</strong><small>Add another household</small></span></Button>
          </div> : null}
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
          <ItemsView household={household} onOpenLocation={(target) => { setLocationTarget(target); navigate('locations') }} onRevealConsumed={() => setResolvedTarget(null)} refreshKey={realtimeRevision} revealItem={resolvedTarget?.type === 'item' ? resolvedTarget.item : undefined} revealItemId={resolvedTarget?.type === 'item' ? resolvedTarget.id : undefined} revealScanKey={resolvedTarget?.type === 'item' ? resolvedTarget.scanKey : undefined} token={token} />
        ) : activeView === 'locations' ? (
          <LocationsView household={household} onRevealConsumed={() => { setResolvedTarget(null); setLocationTarget(null) }} refreshKey={realtimeRevision} revealAreaId={locationTarget?.areaId ?? resolvedTarget?.areaId} revealContainerId={locationTarget?.containerId ?? (resolvedTarget?.type === 'container' ? resolvedTarget.id : resolvedTarget?.containerId)} revealItem={resolvedTarget?.type === 'item' ? resolvedTarget.item : undefined} revealItemId={resolvedTarget?.type === 'item' ? resolvedTarget.id : undefined} revealScanKey={resolvedTarget?.scanKey} revealZoneId={locationTarget?.zoneId ?? resolvedTarget?.zoneId} token={token} />
        ) : activeView === 'settings' ? (
          <SettingsView household={household} households={households} isOwner={isOwner} onCreateHousehold={onCreateHousehold} onNavigate={navigateSettings} onSelect={onSelect} section={settingsSection} token={token} user={user} />
        ) : (
        <>
        <PageHeader className="page-header-overview" id="overview" title={<>{greeting()}, {user.user.display_name.split(' ')[0]} <span className="wave">👋</span></>} />

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
              return <button key={item.id} onClick={() => setSelectedOverviewItem(item)} type="button"><span className="area-icon"><Box aria-hidden="true" /></span><span><strong>{item.name}</strong><small>{itemLocation(placement, overview.areas, overview.zones, overview.containers, overview.containerPlacements)}</small></span><ChevronRight aria-hidden="true" /></button>
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
        {selectedOverviewItem ? <ItemDetailsModal areas={overview.areas} containerPlacements={overview.containerPlacements} containers={overview.containers} imageRevision={realtimeRevision} item={selectedOverviewItem} locationLabel={itemLocation(overview.itemPlacements.find((entry) => entry.item_id === selectedOverviewItem.id), overview.areas, overview.zones, overview.containers, overview.containerPlacements)} onClose={() => setSelectedOverviewItem(null)} onDeleted={() => { setSelectedOverviewItem(null); setRealtimeRevision((current) => current + 1) }} onPlacementUpdated={() => setRealtimeRevision((current) => current + 1)} onUpdated={(item) => { setSelectedOverviewItem(item); setRealtimeRevision((current) => current + 1) }} placement={overview.itemPlacements.find((entry) => entry.item_id === selectedOverviewItem.id)} token={token} zones={overview.zones} /> : null}

        <section className="quick-grid">
          <article><div className="quick-icon"><ArrowRightLeft aria-hidden="true" /></div><div><strong>Transfer items</strong><span>Move inventory between locations.</span></div><small>Coming next</small></article>
          <article><div className="quick-icon"><Camera aria-hidden="true" /></div><div><strong>AI item capture</strong><span>Photograph an item and review suggestions.</span></div><small>Coming next</small></article>
          <article><div className="quick-icon"><Printer aria-hidden="true" /></div><div><strong>Print labels</strong><span>Create QR labels for items and containers.</span></div><small>Coming next</small></article>
        </section>

        </>
        )}
      </section>
      <GlobalFeatureHost household={household} onChanged={() => setRealtimeRevision((current) => current + 1)} token={token} />
      {reviewItemIds.length && !reviewQueueOpen ? <Button className="review-queue-launcher" onClick={() => setReviewQueueOpen(true)}><PackagePlus aria-hidden="true" /><span>{reviewItemIds.length}</span> Review companion items</Button> : null}
      {reviewQueueOpen && reviewItemIds.length ? <CompanionReviewQueue inventory={overview} itemIds={reviewItemIds} onClose={() => setReviewQueueOpen(false)} onReviewed={markReviewed} onUpdated={() => setRealtimeRevision((current) => current + 1)} token={token} /> : null}
    </main>
  )
}
