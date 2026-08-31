import { useCameraPermissions } from 'expo-camera'
import { StatusBar } from 'expo-status-bar'
import { createRemoteClient, subscribeToHousehold, type Item, type StorageContainer } from '@wherehouse/api-client'
import { useEffect, useMemo, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native'

import {
  forgetPairedServer,
  loadPairedServer,
  pairDevice,
  type PairedServer,
} from './src/services/pairing'
import {
  clearInventoryCache,
  cacheItemUpdate,
  loadCachedInventory,
  syncInventory,
  type CachedInventory,
} from './src/services/inventory'
import { styles } from './src/theme/styles'
import { BottomNavigation, type MobileTab } from './src/components/BottomNavigation'
import { ScannerScreen } from './src/components/ScannerScreen'
import { AppHeader } from './src/components/AppHeader'
import { ContainersScreen } from './src/screens/ContainersScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { PairingScreen } from './src/screens/PairingScreen'
import { AddItemScreen } from './src/screens/AddItemScreen'
import { ItemsScreen } from './src/screens/ItemsScreen'
import { EditItemScreen } from './src/screens/EditItemScreen'
import { pendingItemCount, queueItem, queueItemUpdate, recentLocations, syncPendingItems, syncPendingItemUpdates } from './src/services/itemQueue'
import type { ItemDraft, ItemLocationChoice, ItemUpdateDraft } from './src/types/itemDraft'
import { containerLocationChoice, itemLocationChoices, placementLocationChoice } from './src/utils/itemLocations'

const EMPTY_INVENTORY: CachedInventory = {
  areas: [],
  zones: [],
  containers: [],
  placements: [],
  items: [],
  itemPlacements: [],
  syncedAt: null,
}

export default function App() {
  const [pairingUri, setPairingUri] = useState('')
  const [pairedServer, setPairedServer] = useState<PairedServer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [scannerMode, setScannerMode] = useState<'pairing' | 'container' | 'item-location' | null>(null)
  const [activeTab, setActiveTab] = useState<MobileTab>('home')
  const [inventory, setInventory] = useState<CachedInventory>(EMPTY_INVENTORY)
  const [syncing, setSyncing] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState<StorageContainer | null>(null)
  const [addItemLocation, setAddItemLocation] = useState<ItemLocationChoice | undefined>()
  const [recentItemLocations, setRecentItemLocations] = useState<ItemLocationChoice[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [editItemLocation, setEditItemLocation] = useState<ItemLocationChoice | undefined>()
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const locationChoices = useMemo(() => itemLocationChoices(inventory), [inventory])

  useEffect(() => {
    void loadPairedServer().then(setPairedServer).finally(() => setBusy(false))
    void Linking.getInitialURL().then((url) => url?.startsWith('wherehouse://') && setPairingUri(url))
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('wherehouse://')) setPairingUri(url)
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (!pairedServer) {
      setInventory(EMPTY_INVENTORY)
      return
    }
    let cancelled = false
    setSyncing(true)
    void (async () => {
      try {
        const cached = await loadCachedInventory(pairedServer.householdId)
        if (!cancelled) setInventory(cached)
        await syncPendingItems(pairedServer)
        await syncPendingItemUpdates(pairedServer)
        const next = await syncInventory(pairedServer)
        if (!cancelled) {
          setInventory(next)
          setError(null)
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Sync failed.')
      } finally {
        if (cancelled) return
        setSyncing(false)
        void pendingItemCount(pairedServer.householdId).then(setPendingCount)
        void recentLocations(pairedServer.householdId).then(setRecentItemLocations)
      }
    })()
    return () => { cancelled = true }
  }, [pairedServer])

  useEffect(() => {
    if (!pairedServer || pendingCount === 0) return
    let running = false
    const retry = async () => {
      if (running) return
      running = true
      try {
        await syncPendingItems(pairedServer)
        await syncPendingItemUpdates(pairedServer)
        setPendingCount(await pendingItemCount(pairedServer.householdId))
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Pending item sync failed.')
      } finally {
        running = false
      }
    }
    const interval = setInterval(() => void retry(), 30_000)
    return () => clearInterval(interval)
  }, [pairedServer, pendingCount])

  useEffect(() => {
    if (!pairedServer) return
    let running = false
    let rerun = false
    const reconcile = async () => {
      if (running) { rerun = true; return }
      running = true
      try {
        await syncPendingItems(pairedServer)
        await syncPendingItemUpdates(pairedServer)
        setInventory(await syncInventory(pairedServer))
        setPendingCount(await pendingItemCount(pairedServer.householdId))
        setError(null)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Realtime sync failed.')
      } finally {
        running = false
        if (rerun) { rerun = false; void reconcile() }
      }
    }
    return subscribeToHousehold({ baseUrl: pairedServer.baseUrl, householdId: pairedServer.householdId, token: pairedServer.accessToken, onEvent: () => void reconcile(), onReady: () => void reconcile() })
  }, [pairedServer])

  async function pair() {
    setBusy(true)
    setError(null)
    try {
      setPairedServer(await pairDevice(pairingUri, `${Platform.OS} companion`))
      setPairingUri('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pairing failed.')
    } finally {
      setBusy(false)
    }
  }

  async function forget() {
    setBusy(true)
    if (pairedServer) await clearInventoryCache(pairedServer.householdId)
    await forgetPairedServer()
    setPairedServer(null)
    setBusy(false)
  }

  async function openScanner(mode: 'pairing' | 'container' | 'item-location') {
    setError(null)
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission()
      if (!permission.granted) {
        setError('Camera access is required to scan a pairing code.')
        return
      }
    }
    setScannerMode(mode)
  }

  async function refreshInventory() {
    if (!pairedServer) return
    setSyncing(true)
    setError(null)
    try {
      await syncPendingItems(pairedServer)
      await syncPendingItemUpdates(pairedServer)
      setInventory(await syncInventory(pairedServer))
      setPendingCount(await pendingItemCount(pairedServer.householdId))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  async function saveItem(draft: ItemDraft): Promise<'queued' | 'synced'> {
    if (!pairedServer) throw new Error('Pair this phone before adding items.')
    await queueItem(pairedServer.householdId, draft)
    setPendingCount(await pendingItemCount(pairedServer.householdId))
    setRecentItemLocations(await recentLocations(pairedServer.householdId))
    setAddItemLocation(draft.location)
    void syncPendingItems(pairedServer)
      .then(async () => {
        setPendingCount(await pendingItemCount(pairedServer.householdId))
        setInventory(await syncInventory(pairedServer))
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Item will retry when connected.'))
    return 'queued'
  }

  async function updateItem(draft: ItemUpdateDraft): Promise<'queued' | 'synced'> {
    if (!pairedServer || !editingItem) throw new Error('Pair this phone before editing items.')
    await queueItemUpdate(pairedServer.householdId, draft)
    const optimisticItem: Item = { ...editingItem, name: draft.name, quantity: String(draft.quantity), identifier_type: draft.identifierType, unit: draft.unit ?? null, manufacturer: draft.manufacturer ?? null, model: draft.model ?? null, serial_number: draft.serialNumber ?? null, description: draft.description ?? null, notes: draft.notes ?? null, updated_at: draft.updatedAt }
    const previousPlacement = inventory.itemPlacements.find((entry) => entry.item_id === draft.itemId)
    const optimisticPlacement = draft.location ? { id: previousPlacement?.id ?? `local-${draft.itemId}`, item_id: draft.itemId, area_id: draft.location.kind === 'area' ? draft.location.id : null, zone_id: draft.location.kind === 'zone' ? draft.location.id : null, container_id: draft.location.kind === 'container' ? draft.location.id : null, relationship_type: draft.location.kind === 'container' ? 'in' as const : null, created_at: previousPlacement?.created_at ?? draft.updatedAt, updated_at: draft.updatedAt } : previousPlacement
    const next = { ...inventory, items: inventory.items.map((item) => item.id === draft.itemId ? optimisticItem : item), itemPlacements: optimisticPlacement ? [...inventory.itemPlacements.filter((entry) => entry.item_id !== draft.itemId), optimisticPlacement] : inventory.itemPlacements }
    setInventory(next)
    await cacheItemUpdate(pairedServer.householdId, optimisticItem, optimisticPlacement)
    setPendingCount(await pendingItemCount(pairedServer.householdId))
    void syncPendingItemUpdates(pairedServer)
      .then(async () => {
        setPendingCount(await pendingItemCount(pairedServer.householdId))
        setInventory(await syncInventory(pairedServer))
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Item update will retry when connected.'))
    return 'queued'
  }

  async function openContainerCode(value: string) {
    if (!pairedServer) return
    const trimmed = value.trim()
    let code = trimmed
    if (trimmed.startsWith('wherehouse://container/')) {
      code = decodeURIComponent(trimmed.slice('wherehouse://container/'.length).split(/[?#]/)[0])
    }
    setBusy(true)
    setError(null)
    try {
      const client = createRemoteClient(pairedServer.baseUrl, pairedServer.accessToken)
      const container = await client.getContainerByCode(code)
      setSelectedContainer(container)
      setActiveTab('containers')
    } catch (reason) {
      const cached = inventory.containers.find((container) => container.code === code.toUpperCase())
      if (cached) {
        setSelectedContainer(cached)
        setActiveTab('containers')
      } else {
        setError(reason instanceof Error ? reason.message : 'Container not found.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function selectItemLocationCode(value: string) {
    if (!pairedServer) return
    const trimmed = value.trim()
    const code = trimmed.startsWith('wherehouse://container/') ? decodeURIComponent(trimmed.slice('wherehouse://container/'.length).split(/[?#]/)[0]) : trimmed
    try {
      const client = createRemoteClient(pairedServer.baseUrl, pairedServer.accessToken)
      const container = await client.getContainerByCode(code)
      const location = containerLocationChoice(container, inventory)
      if (editingItem) setEditItemLocation(location)
      else { setAddItemLocation(location); setActiveTab('add-item') }
    } catch (reason) {
      const cached = inventory.containers.find((container) => container.code === code.toUpperCase())
      if (cached) {
        const location = containerLocationChoice(cached, inventory)
        if (editingItem) setEditItemLocation(location)
        else { setAddItemLocation(location); setActiveTab('add-item') }
      }
      else setError(reason instanceof Error ? reason.message : 'Container not found.')
    }
  }

  if (scannerMode) {
    return <ScannerScreen mode={scannerMode} onCancel={() => setScannerMode(null)} onError={setError} onScan={(data) => { setError(null); setScannerMode(null); if (scannerMode === 'pairing') setPairingUri(data); else if (scannerMode === 'item-location') void selectItemLocationCode(data); else void openContainerCode(data) }} />
  }

  if (pairedServer && activeTab === 'add-item') return <SafeAreaView style={styles.safeArea}><AddItemScreen choices={locationChoices} initialLocation={addItemLocation} onCancel={() => setActiveTab('home')} onSave={saveItem} onScanLocation={() => void openScanner('item-location')} recent={recentItemLocations} /><StatusBar style="auto" /></SafeAreaView>

  if (pairedServer && editingItem) return <SafeAreaView style={styles.safeArea}><EditItemScreen choices={locationChoices} item={editingItem} location={editItemLocation ?? placementLocationChoice(inventory.itemPlacements.find((entry) => entry.item_id === editingItem.id), inventory)} onCancel={() => { setEditingItem(null); setEditItemLocation(undefined) }} onSave={updateItem} onScanLocation={() => void openScanner('item-location')} recent={recentItemLocations} /><StatusBar style="auto" /></SafeAreaView>

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppHeader connected={Boolean(pairedServer)} />
          <Text style={styles.title}>{pairedServer ? activeTab === 'containers' ? 'Containers' : activeTab === 'items' ? 'Items' : 'Companion ready' : 'Connect companion'}</Text>
          <Text style={styles.subtitle}>
            {pairedServer ? activeTab === 'containers' ? 'Browse cached storage or scan a container label.' : activeTab === 'items' ? 'Find and update your household inventory.' : 'Your household will stay close, even when the signal does not.' : 'Pair this phone with your household to get started.'}
          </Text>
          {busy ? (
            <ActivityIndicator style={styles.activity} color="#166534" size="large" />
          ) : pairedServer && activeTab === 'home' ? <HomeScreen error={error} inventory={inventory} onAddItem={() => { setAddItemLocation(undefined); setActiveTab('add-item') }} onBrowse={() => setActiveTab('containers')} onForget={() => void forget()} onRefresh={() => void refreshInventory()} onScan={() => void openScanner('container')} pendingCount={pendingCount} server={pairedServer} syncing={syncing} />
            : pairedServer && activeTab === 'items' ? <ItemsScreen error={error} inventory={inventory} onEdit={(item) => { setEditItemLocation(undefined); setEditingItem(item) }} onRefresh={() => void refreshInventory()} syncing={syncing} />
            : pairedServer ? <ContainersScreen error={error} inventory={inventory} onAddItem={(container) => { setAddItemLocation(containerLocationChoice(container, inventory)); setActiveTab('add-item') }} onRefresh={() => void refreshInventory()} onSelect={setSelectedContainer} selected={selectedContainer} syncing={syncing} />
              : <PairingScreen error={error} onChange={setPairingUri} onPair={() => void pair()} onScan={() => void openScanner('pairing')} value={pairingUri} />}
        </ScrollView>
        {pairedServer ? (
          <BottomNavigation activeTab={activeTab} onAddItem={() => { setAddItemLocation(undefined); setActiveTab('add-item') }} onSelect={(tab) => { setActiveTab(tab); if (tab === 'items') void refreshInventory() }} />
        ) : null}
        <StatusBar style="auto" />
      </View>
    </SafeAreaView>
  )
}
