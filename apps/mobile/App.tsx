import { useCameraPermissions } from 'expo-camera'
import { StatusBar } from 'expo-status-bar'
import { createRemoteClient, listHouseholds, parseIdentifierPayload, subscribeToHousehold, type Household, type IdentifierResolution, type Item, type StorageContainer } from '@wherehouse/api-client'
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
  isPairingUri,
  loadPairedServer,
  pairDevice,
  savePairedServer,
  type PairedServer,
} from './src/services/pairing'
import {
  cacheItemUpdate,
  loadCachedInventory,
  syncInventory,
  type CachedInventory,
} from './src/services/inventory'
import { styles } from './src/theme/styles'
import { BottomNavigation, type MobileTab } from './src/components/BottomNavigation'
import { ScannerScreen } from './src/components/ScannerScreen'
import { AppHeader } from './src/components/AppHeader'
import { LocationSelectorSheet } from './src/components/LocationSelectorSheet'
import { ConfirmModal } from './src/components/ConfirmModal'
import { LocationsScreen } from './src/screens/LocationsScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { PairingScreen } from './src/screens/PairingScreen'
import { AddItemScreen } from './src/screens/AddItemScreen'
import { ItemsScreen } from './src/screens/ItemsScreen'
import { EditItemScreen } from './src/screens/EditItemScreen'
import { ScanSessionScreen } from './src/screens/ScanSessionScreen'
import { pendingItemCount, queueItem, queueItemUpdate, recentLocations, syncPendingItems, syncPendingItemUpdates } from './src/services/itemQueue'
import type { ItemDraft, ItemLocationChoice, ItemUpdateDraft } from './src/types/itemDraft'
import { containerLocationChoice, itemLocationChoices, placementLocationChoice } from './src/utils/itemLocations'
import { EmptyNfcTagError, readNfcIdentifier, writeNfcIdentifier } from './src/services/nfc'
import { cacheItemImage } from './src/services/itemImages'
import { SettingsScreen } from './src/features/settings/SettingsScreen'

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
  const [scannerMode, setScannerMode] = useState<'pairing' | 'identify' | 'item-location' | null>(null)
  const [activeTab, setActiveTab] = useState<MobileTab>('home')
  const [inventory, setInventory] = useState<CachedInventory>(EMPTY_INVENTORY)
  const [syncing, setSyncing] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<ItemLocationChoice | null>(null)
  const [locationSelectorOpen, setLocationSelectorOpen] = useState(false)
  const [addItemLocation, setAddItemLocation] = useState<ItemLocationChoice | undefined>()
  const [recentItemLocations, setRecentItemLocations] = useState<ItemLocationChoice[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [editItemLocation, setEditItemLocation] = useState<ItemLocationChoice | undefined>()
  const [editingItemImageUri, setEditingItemImageUri] = useState<string | undefined>()
  const [scanSessionOpen, setScanSessionOpen] = useState(false)
  const [scanSessionEntries, setScanSessionEntries] = useState<IdentifierResolution[]>([])
  const [emptyNfcPromptOpen, setEmptyNfcPromptOpen] = useState(false)
  const [linkNewItemToNfc, setLinkNewItemToNfc] = useState(false)
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
    if (!pairedServer) return
    let cancelled = false
    void listHouseholds(pairedServer.accessToken, pairedServer.baseUrl).then(async (households) => {
      const active = households.find((household) => household.id === pairedServer.householdId)
      if (!active || active.name === pairedServer.instanceName || cancelled) return
      const next = { ...pairedServer, instanceName: active.name }
      await savePairedServer(next)
      if (!cancelled) setPairedServer(next)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [pairedServer?.accessToken, pairedServer?.householdId])

  useEffect(() => {
    setEditingItemImageUri(undefined)
    if (!pairedServer || !editingItem?.image_path) return
    let cancelled = false
    void cacheItemImage(pairedServer, editingItem)
      .then((uri) => { if (!cancelled) setEditingItemImageUri(uri) })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Item image could not be loaded.') })
    return () => { cancelled = true }
  }, [editingItem, pairedServer])

  useEffect(() => {
    if (!editingItem) return
    const refreshed = inventory.items.find((item) => item.id === editingItem.id)
    if (refreshed && refreshed !== editingItem) setEditingItem(refreshed)
  }, [editingItem?.id, inventory.items])

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

  async function pairFromScan(value: string) {
    const next = await pairDevice(value, `${Platform.OS} companion`)
    setSelectedLocation(null)
    setAddItemLocation(undefined)
    setEditItemLocation(undefined)
    setEditingItem(null)
    setInventory(EMPTY_INVENTORY)
    setScanSessionEntries([])
    setScanSessionOpen(false)
    setScannerMode(null)
    setPairedServer(next)
    setActiveTab('home')
    setError(null)
  }

  async function forget() {
    setBusy(true)
    await forgetPairedServer()
    setPairedServer(null)
    setBusy(false)
  }

  async function switchHousehold(household: Household) {
    if (!pairedServer || pairedServer.householdId === household.id) return
    const next = { ...pairedServer, householdId: household.id, instanceName: household.name }
    setSelectedLocation(null)
    setAddItemLocation(undefined)
    setEditItemLocation(undefined)
    setEditingItem(null)
    setInventory(EMPTY_INVENTORY)
    await savePairedServer(next)
    setPairedServer(next)
    setActiveTab('home')
  }

  async function openScanner(mode: 'pairing' | 'identify' | 'item-location') {
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
    if (linkNewItemToNfc) {
      let result = await syncPendingItems(pairedServer)
      let itemId = result.itemIds[draft.localId]
      if (!itemId) {
        result = await syncPendingItems(pairedServer)
        itemId = result.itemIds[draft.localId]
      }
      if (!itemId) throw new Error('The item was saved on this phone, but it must sync before the NFC tag can be linked. Try again when connected.')
      await writeItemNfc(itemId)
      setPendingCount(await pendingItemCount(pairedServer.householdId))
      setInventory(await syncInventory(pairedServer))
      return 'synced'
    }
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

  async function archiveItem(item: Item): Promise<void> {
    if (!pairedServer) throw new Error('Pair this phone before archiving items.')
    await createRemoteClient(pairedServer.baseUrl, pairedServer.accessToken).deleteItem(item.id)
    setInventory((current) => ({
      ...current,
      items: current.items.filter((entry) => entry.id !== item.id),
      itemPlacements: current.itemPlacements.filter((entry) => entry.item_id !== item.id),
    }))
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
      setSelectedLocation(containerLocationChoice(container, inventory))
      setActiveTab('containers')
    } catch (reason) {
      const cached = inventory.containers.find((container) => container.code === code.toUpperCase())
      if (cached) {
        setSelectedLocation(containerLocationChoice(cached, inventory))
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

  async function identify(value: string) {
    if (!pairedServer) return
    if (isPairingUri(value)) {
      setBusy(true)
      try { await pairFromScan(value) }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'Household pairing failed.') }
      finally { setBusy(false) }
      return
    }
    const parsed = parseIdentifierPayload(value)
    if (!parsed || parsed.version !== 1) return openContainerCode(value)
    setBusy(true)
    setError(null)
    try {
      const result = await createRemoteClient(pairedServer.baseUrl, pairedServer.accessToken).resolveIdentifier(parsed.publicId)
      if (result.container) { setSelectedLocation(containerLocationChoice(result.container, inventory)); setActiveTab('containers') }
      else if (result.item) { setEditingItem(result.item); setActiveTab('items') }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Identifier could not be resolved.')
    } finally { setBusy(false) }
  }

  async function resolveForScanSession(value: string) {
    if (!pairedServer) return
    if (isPairingUri(value)) {
      await pairFromScan(value)
      return
    }
    const parsed = parseIdentifierPayload(value)
    if (!parsed || parsed.version !== 1) throw new Error('That is not a supported WhereHouse identifier.')
    const result = await createRemoteClient(pairedServer.baseUrl, pairedServer.accessToken).resolveIdentifier(parsed.publicId)
    setScanSessionEntries((current) => current.some((entry) => entry.identifier.target_type === result.identifier.target_type && entry.identifier.target_id === result.identifier.target_id) ? current : [...current, result])
  }

  async function openScanSession() {
    setError(null)
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission()
      if (!permission.granted) return setError('Camera access is required to scan QR codes.')
    }
    setScanSessionEntries([])
    setScanSessionOpen(true)
  }

  function openScanSessionEntry(entry: IdentifierResolution) {
    setScanSessionOpen(false)
    if (entry.item) { setEditingItem(entry.item); setActiveTab('items') }
    else if (entry.container) { setSelectedLocation(containerLocationChoice(entry.container, inventory)); setActiveTab('containers') }
  }

  async function readNfc() {
    setError(null)
    try { await identify(await readNfcIdentifier()) }
    catch (reason) {
      if (reason instanceof EmptyNfcTagError) setEmptyNfcPromptOpen(true)
      else setError(reason instanceof Error ? reason.message : 'NFC read failed.')
    }
  }

  async function addNfcToScanSession() {
    try { await resolveForScanSession(await readNfcIdentifier()) }
    catch (reason) {
      if (!(reason instanceof EmptyNfcTagError)) throw reason
      setScanSessionOpen(false)
      setEmptyNfcPromptOpen(true)
    }
  }

  async function writeItemNfc(item: Item | string) {
    if (!pairedServer) return
    const identifier = await createRemoteClient(pairedServer.baseUrl, pairedServer.accessToken).createIdentifier('item', typeof item === 'string' ? item : item.id, 'nfc')
    await writeNfcIdentifier(identifier.payload)
    await createRemoteClient(pairedServer.baseUrl, pairedServer.accessToken).activateIdentifier(identifier.id)
  }

  async function writeContainerNfc(container: StorageContainer) {
    if (!pairedServer) return
    setError(null)
    try {
      const client = createRemoteClient(pairedServer.baseUrl, pairedServer.accessToken)
      const identifier = await client.createIdentifier('container', container.id, 'nfc')
      await writeNfcIdentifier(identifier.payload)
      await client.activateIdentifier(identifier.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not write NFC tag.')
    }
  }

  function openLocations() {
    setLocationSelectorOpen(true)
  }

  function selectLocation(location: ItemLocationChoice) {
    setSelectedLocation(location)
    setLocationSelectorOpen(false)
    setActiveTab('containers')
  }

  if (scannerMode) {
    return <ScannerScreen mode={scannerMode} onCancel={() => setScannerMode(null)} onError={setError} onScan={(data) => { setError(null); setScannerMode(null); if (scannerMode === 'pairing') setPairingUri(data); else if (scannerMode === 'item-location') void selectItemLocationCode(data); else void identify(data) }} />
  }


  if (scanSessionOpen) return <ScanSessionScreen entries={scanSessionEntries} onClose={() => setScanSessionOpen(false)} onNfc={addNfcToScanSession} onOpen={openScanSessionEntry} onQr={resolveForScanSession} />

  if (pairedServer && activeTab === 'add-item') return <SafeAreaView style={styles.safeArea}><AddItemScreen choices={locationChoices} initialLocation={addItemLocation} linkNfc={linkNewItemToNfc} onCancel={() => { setLinkNewItemToNfc(false); setActiveTab('home') }} onSave={saveItem} onScanLocation={() => void openScanner('item-location')} recent={recentItemLocations} /><StatusBar style="auto" /></SafeAreaView>

  if (pairedServer && editingItem) return <SafeAreaView style={styles.safeArea}><EditItemScreen choices={locationChoices} imageUri={editingItemImageUri} item={editingItem} location={editItemLocation ?? placementLocationChoice(inventory.itemPlacements.find((entry) => entry.item_id === editingItem.id), inventory)} onArchive={() => archiveItem(editingItem)} onCancel={() => { setEditingItem(null); setEditItemLocation(undefined) }} onSave={updateItem} onScanLocation={() => void openScanner('item-location')} onWriteNfc={() => writeItemNfc(editingItem)} recent={recentItemLocations} /><StatusBar style="auto" /></SafeAreaView>

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppHeader connected={Boolean(pairedServer)} />
          <Text style={styles.title}>{pairedServer ? activeTab === 'containers' ? 'Locations' : activeTab === 'items' ? 'Items' : activeTab === 'more' ? 'Settings' : 'Companion ready' : 'Connect companion'}</Text>
          <Text style={styles.subtitle}>
            {pairedServer ? activeTab === 'containers' ? 'Browse areas, zones, containers, and everything stored inside.' : activeTab === 'items' ? 'Find and update your household inventory.' : activeTab === 'more' ? `Manage ${pairedServer.instanceName}, your account, and this app.` : 'Your household will stay close, even when the signal does not.' : 'Pair this phone with your household to get started.'}
          </Text>
          {busy ? (
            <ActivityIndicator style={styles.activity} color="#166534" size="large" />
          ) : pairedServer && activeTab === 'home' ? <HomeScreen error={error} inventory={inventory} onAddItem={() => { setAddItemLocation(undefined); setActiveTab('add-item') }} onBrowse={openLocations} onNfc={() => void readNfc()} onRefresh={() => void refreshInventory()} onScan={() => void openScanSession()} pendingCount={pendingCount} server={pairedServer} syncing={syncing} />
            : pairedServer && activeTab === 'items' ? <ItemsScreen error={error} inventory={inventory} onEdit={(item) => { setEditItemLocation(undefined); setEditingItem(item) }} onRefresh={() => void refreshInventory()} syncing={syncing} />
            : pairedServer && activeTab === 'more' ? <SettingsScreen onForget={() => void forget()} onSwitch={switchHousehold} server={pairedServer} />
            : pairedServer ? <LocationsScreen error={error} inventory={inventory} onAddItem={(location) => { setAddItemLocation(location); setActiveTab('add-item') }} onChangeLocation={openLocations} onOpenItem={(item) => { setEditItemLocation(undefined); setEditingItem(item) }} onRefresh={() => void refreshInventory()} onSelect={setSelectedLocation} onWriteNfc={async (containerId) => { const container = inventory.containers.find((entry) => entry.id === containerId); if (container) await writeContainerNfc(container) }} selected={selectedLocation} syncing={syncing} />
              : <PairingScreen error={error} onChange={setPairingUri} onPair={() => void pair()} onScan={() => void openScanner('pairing')} value={pairingUri} />}
        </ScrollView>
        {pairedServer ? (
          <BottomNavigation activeTab={activeTab} onAddItem={() => { setAddItemLocation(undefined); setActiveTab('add-item') }} onLocations={openLocations} onNfc={() => void readNfc()} onScan={() => void openScanSession()} onSelect={(tab) => { setActiveTab(tab); if (tab === 'items') void refreshInventory() }} />
        ) : null}
        {pairedServer ? <LocationSelectorSheet inventory={inventory} onClose={() => setLocationSelectorOpen(false)} onSelect={selectLocation} syncing={syncing} visible={locationSelectorOpen} /> : null}
        <ConfirmModal
          confirmLabel="Create item"
          description="Would you like to create a new item and link this NFC tag to it? You will tap the tag again after saving the item."
          onCancel={() => setEmptyNfcPromptOpen(false)}
          onConfirm={() => { setEmptyNfcPromptOpen(false); setLinkNewItemToNfc(true); setAddItemLocation(undefined); setActiveTab('add-item') }}
          title="This NFC tag isn't registered"
          visible={emptyNfcPromptOpen}
        />
        <StatusBar style="auto" />
      </View>
    </SafeAreaView>
  )
}
