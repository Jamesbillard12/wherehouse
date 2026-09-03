import { useCameraPermissions } from 'expo-camera'
import { StatusBar } from 'expo-status-bar'
import { ApiError, createRemoteClient, listWorkspaces, parseIdentifierPayload, subscribeToWorkspace, type Workspace, type IdentifierResolution, type Item, type StorageContainer } from '@wherehouse/api-client'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  loadStoredPairing,
  markPairedServerRevoked,
  pairDevice,
  savePairedServer,
  type PairedServer,
} from './src/services/pairing'
import {
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
import { failedItemCount, pendingItemCount, quarantinePendingItemsAfterCredentialRemoval, queueItem, recentLocations, syncPendingItems } from './src/services/itemQueue'
import type { ItemDraft, ItemLocationChoice, ItemUpdateDraft } from './src/types/itemDraft'
import { containerLocationChoice, itemLocationChoices, placementLocationChoice } from './src/utils/itemLocations'
import { EmptyNfcTagError, readNfcIdentifier, writeNfcIdentifier } from './src/services/nfc'
import { cacheItemImage } from './src/services/itemImages'
import { SettingsScreen } from './src/features/settings/SettingsScreen'
import { isRevocationForConnection } from './src/services/connectionPolicy'

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
  const [revokedConnection, setRevokedConnection] = useState<PairedServer | null>(null)
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
  const [failedCount, setFailedCount] = useState(0)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [editItemLocation, setEditItemLocation] = useState<ItemLocationChoice | undefined>()
  const [editingItemImageUri, setEditingItemImageUri] = useState<string | undefined>()
  const [scanSessionOpen, setScanSessionOpen] = useState(false)
  const [scanSessionEntries, setScanSessionEntries] = useState<IdentifierResolution[]>([])
  const [emptyNfcPromptOpen, setEmptyNfcPromptOpen] = useState(false)
  const [linkNewItemToNfc, setLinkNewItemToNfc] = useState(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const locationChoices = useMemo(() => itemLocationChoices(inventory), [inventory])
  const searchInventory = useCallback((query: string) => {
    if (!pairedServer) return Promise.resolve([])
    const client = createRemoteClient(pairedServer.baseUrl, pairedServer.accessToken)
    return Promise.all([
      client.searchItems(pairedServer.workspaceId, query),
      client.searchContainers(pairedServer.workspaceId, query),
    ]).then(([items, containers]) => [
      ...items.map((result) => ({ kind: 'item' as const, ...result })),
      ...containers.map((result) => ({ kind: 'container' as const, ...result })),
    ])
  }, [pairedServer])

  useEffect(() => {
    void loadStoredPairing().then((stored) => {
      if (stored?.status === 'revoked') setRevokedConnection(stored)
      else setPairedServer(stored)
    }).finally(() => setBusy(false))
    void Linking.getInitialURL().then((url) => url?.startsWith('wherehouse://') && setPairingUri(url))
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('wherehouse://')) setPairingUri(url)
    })
    return () => subscription.remove()
  }, [])

  function clearProtectedState() {
    setSelectedLocation(null)
    setAddItemLocation(undefined)
    setEditItemLocation(undefined)
    setEditingItem(null)
    setInventory(EMPTY_INVENTORY)
    setScanSessionEntries([])
    setScanSessionOpen(false)
    setScannerMode(null)
    setPendingCount(0)
    setFailedCount(0)
    setActiveTab('home')
  }

  async function handleRevoked(server: PairedServer) {
    await quarantinePendingItemsAfterCredentialRemoval()
    const stored = await loadStoredPairing()
    if (!stored || stored.deviceId !== server.deviceId || stored.status === 'revoked') return
    const revoked = await markPairedServerRevoked(server)
    clearProtectedState()
    setPairedServer(null)
    setRevokedConnection(revoked)
    setError('This device no longer has access to this household. Pair it again to reconnect. Unsynced work remains saved on this device and will not upload automatically.')
  }

  function handleConnectionError(reason: unknown, fallback: string) {
    if (pairedServer && reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
      void handleRevoked(pairedServer)
      return
    }
    setError(reason instanceof Error ? reason.message : fallback)
  }

  useEffect(() => {
    if (!pairedServer) {
      setInventory(EMPTY_INVENTORY)
      return
    }
    let cancelled = false
    setSyncing(true)
    void (async () => {
      try {
        const cached = await loadCachedInventory(pairedServer.workspaceId)
        if (!cancelled) setInventory(cached)
        await syncPendingItems(pairedServer)
        const next = await syncInventory(pairedServer)
        if (!cancelled) {
          setInventory(next)
          setError(null)
        }
      } catch (reason) {
        if (!cancelled) handleConnectionError(reason, 'Sync failed.')
      } finally {
        if (cancelled) return
        setSyncing(false)
        void pendingItemCount(pairedServer.workspaceId).then(setPendingCount)
        void failedItemCount(pairedServer.workspaceId).then(setFailedCount)
        void recentLocations(pairedServer.workspaceId).then(setRecentItemLocations)
      }
    })()
    return () => { cancelled = true }
  }, [pairedServer])

  useEffect(() => {
    if (!pairedServer) return
    let cancelled = false
    void listWorkspaces(pairedServer.accessToken, pairedServer.baseUrl).then(async (workspaces) => {
      const active = workspaces.find((workspace) => workspace.id === pairedServer.workspaceId)
      if (!active || active.name === pairedServer.instanceName || cancelled) return
      const next = { ...pairedServer, instanceName: active.name }
      await savePairedServer(next)
      if (!cancelled) setPairedServer(next)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [pairedServer?.accessToken, pairedServer?.workspaceId])

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
        setPendingCount(await pendingItemCount(pairedServer.workspaceId))
        setFailedCount(await failedItemCount(pairedServer.workspaceId))
      } catch (reason) {
        handleConnectionError(reason, 'Pending item sync failed.')
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
        setInventory(await syncInventory(pairedServer))
        setPendingCount(await pendingItemCount(pairedServer.workspaceId))
        setFailedCount(await failedItemCount(pairedServer.workspaceId))
        setError(null)
      } catch (reason) {
        handleConnectionError(reason, 'Realtime sync failed.')
      } finally {
        running = false
        if (rerun) { rerun = false; void reconcile() }
      }
    }
    const current = pairedServer
    return subscribeToWorkspace({
      baseUrl: current.baseUrl,
      workspaceId: current.workspaceId,
      token: current.accessToken,
      onEvent: () => void reconcile(),
      onReady: () => void reconcile(),
      onDeviceRevoked: (event) => {
        if (isRevocationForConnection(current, event)) void handleRevoked(current)
      },
      onAuthorizationFailure: () => void handleRevoked(current),
    })
  }, [pairedServer])

  async function pair() {
    setBusy(true)
    setError(null)
    try {
      setPairedServer(await pairDevice(pairingUri, `${Platform.OS} companion`))
      setRevokedConnection(null)
      setPairingUri('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pairing failed.')
    } finally {
      setBusy(false)
    }
  }

  async function pairFromScan(value: string) {
    const next = await pairDevice(value, `${Platform.OS} companion`)
    setRevokedConnection(null)
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
    await quarantinePendingItemsAfterCredentialRemoval()
    await forgetPairedServer()
    clearProtectedState()
    setPairedServer(null)
    setRevokedConnection(null)
    setBusy(false)
  }

  async function switchWorkspace(workspace: Workspace) {
    if (!pairedServer || pairedServer.workspaceId === workspace.id) return
    const next = { ...pairedServer, workspaceId: workspace.id, instanceName: workspace.name }
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
      setInventory(await syncInventory(pairedServer))
      setPendingCount(await pendingItemCount(pairedServer.workspaceId))
      setFailedCount(await failedItemCount(pairedServer.workspaceId))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  async function saveItem(draft: ItemDraft): Promise<'queued' | 'synced'> {
    if (!pairedServer) throw new Error('Pair this phone before adding items.')
    await queueItem(pairedServer.workspaceId, draft)
    setInventory(await loadCachedInventory(pairedServer.workspaceId))
    setPendingCount(await pendingItemCount(pairedServer.workspaceId))
    setFailedCount(await failedItemCount(pairedServer.workspaceId))
    setRecentItemLocations(await recentLocations(pairedServer.workspaceId))
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
      setPendingCount(await pendingItemCount(pairedServer.workspaceId))
      setFailedCount(await failedItemCount(pairedServer.workspaceId))
      setInventory(await syncInventory(pairedServer))
      return 'synced'
    }
    void syncPendingItems(pairedServer)
      .then(async () => {
        setPendingCount(await pendingItemCount(pairedServer.workspaceId))
        setInventory(await syncInventory(pairedServer))
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Item will retry when connected.'))
    return 'queued'
  }

  async function updateItem(draft: ItemUpdateDraft): Promise<'queued' | 'synced'> {
    if (!pairedServer || !editingItem) throw new Error('Pair this phone before editing items.')
    const client = createRemoteClient(pairedServer.baseUrl, pairedServer.accessToken)
    await client.updateItem(draft.itemId, { name: draft.name, identifier_type: draft.identifierType, description: draft.description, quantity: draft.quantity, unit: draft.unit, manufacturer: draft.manufacturer, model: draft.model, serial_number: draft.serialNumber, notes: draft.notes, ...(draft.location ? { placement: { [`${draft.location.kind}_id`]: draft.location.id, ...(draft.location.kind === 'container' ? { relationship_type: 'in' as const } : {}) } } : {}) })
    if (draft.photoUri) {
      const response = await fetch(draft.photoUri)
      await client.uploadItemImage(draft.itemId, await response.blob(), draft.photoMimeType)
    }
    setInventory(await syncInventory(pairedServer))
    return 'synced'
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
          ) : pairedServer && activeTab === 'home' ? <HomeScreen error={error} failedCount={failedCount} inventory={inventory} onAddItem={() => { setAddItemLocation(undefined); setActiveTab('add-item') }} onBrowse={openLocations} onNfc={() => void readNfc()} onRefresh={() => void refreshInventory()} onScan={() => void openScanSession()} pendingCount={pendingCount} server={pairedServer} syncing={syncing} />
            : pairedServer && activeTab === 'items' ? <ItemsScreen error={error} workspaceId={pairedServer.workspaceId} inventory={inventory} onEdit={(item) => { setEditItemLocation(undefined); setEditingItem(item) }} onOpenContainer={(container) => { setSelectedLocation(containerLocationChoice(container, inventory)); setActiveTab('containers') }} onRefresh={() => void refreshInventory()} search={searchInventory} syncing={syncing} />
            : pairedServer && activeTab === 'more' ? <SettingsScreen onForget={() => void forget()} onSwitch={switchWorkspace} server={pairedServer} />
            : pairedServer ? <LocationsScreen error={error} inventory={inventory} onAddItem={(location) => { setAddItemLocation(location); setActiveTab('add-item') }} onChangeLocation={openLocations} onOpenItem={(item) => { setEditItemLocation(undefined); setEditingItem(item) }} onRefresh={() => void refreshInventory()} onSelect={setSelectedLocation} onWriteNfc={async (containerId) => { const container = inventory.containers.find((entry) => entry.id === containerId); if (container) await writeContainerNfc(container) }} selected={selectedLocation} syncing={syncing} />
              : <PairingScreen error={error ?? (revokedConnection ? 'This device no longer has access to its household. Pair it again to reconnect.' : null)} onChange={setPairingUri} onPair={() => void pair()} onScan={() => void openScanner('pairing')} value={pairingUri} />}
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
