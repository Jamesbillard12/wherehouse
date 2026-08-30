import { CameraView, useCameraPermissions } from 'expo-camera'
import { StatusBar } from 'expo-status-bar'
import { createRemoteClient, type StorageContainer } from '@wherehouse/api-client'
import {
  ArrowRightLeft,
  Box,
  Clock3,
  House,
  MoreHorizontal,
  MapPin,
  PackagePlus,
  QrCode,
  Search,
  RefreshCw,
} from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import {
  forgetPairedServer,
  loadPairedServer,
  pairDevice,
  type PairedServer,
} from './src/pairing'
import {
  clearInventoryCache,
  loadCachedInventory,
  syncInventory,
  type CachedInventory,
} from './src/inventory'

const EMPTY_INVENTORY: CachedInventory = {
  areas: [],
  zones: [],
  containers: [],
  placements: [],
  syncedAt: null,
}

export default function App() {
  const [pairingUri, setPairingUri] = useState('')
  const [pairedServer, setPairedServer] = useState<PairedServer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [scannerMode, setScannerMode] = useState<'pairing' | 'container' | null>(null)
  const [activeTab, setActiveTab] = useState<'home' | 'containers'>('home')
  const [inventory, setInventory] = useState<CachedInventory>(EMPTY_INVENTORY)
  const [syncing, setSyncing] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState<StorageContainer | null>(null)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

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
    void loadCachedInventory(pairedServer.householdId).then((cached) => {
      if (!cancelled) setInventory(cached)
    })
    setSyncing(true)
    void syncInventory(pairedServer)
      .then((next) => {
        if (!cancelled) {
          setInventory(next)
          setError(null)
        }
      })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : 'Sync failed.'))
      .finally(() => !cancelled && setSyncing(false))
    return () => { cancelled = true }
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

  async function openScanner(mode: 'pairing' | 'container') {
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
      setInventory(await syncInventory(pairedServer))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
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

  if (scannerMode) {
    return (
      <View style={styles.scannerScreen}>
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (scannerMode === 'pairing' && !data.startsWith('wherehouse://pair?')) {
              setError('That QR code is not a WhereHouse pairing code.')
              setScannerMode(null)
              return
            }
            setError(null)
            setScannerMode(null)
            if (scannerMode === 'pairing') setPairingUri(data)
            else void openContainerCode(data)
          }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.scannerOverlay}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>{scannerMode === 'pairing' ? 'Scan pairing code' : 'Scan container'}</Text>
            <Pressable onPress={() => setScannerMode(null)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
          <View style={styles.finder} />
          <Text style={styles.scannerHelp}>{scannerMode === 'pairing' ? 'Center the QR code shown in WhereHouse web.' : 'Center a WhereHouse container label.'}</Text>
        </SafeAreaView>
        <StatusBar style="light" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <View style={styles.brandLockup}>
              <View style={styles.brandMark}><House color="#fff" size={17} strokeWidth={2.5} /></View>
              <Text style={styles.brand}>WhereHouse</Text>
            </View>
            {pairedServer ? <View style={styles.syncPill}><View style={styles.syncDot} /><Text style={styles.syncText}>Connected</Text></View> : null}
          </View>
          <Text style={styles.title}>{pairedServer ? activeTab === 'containers' ? 'Containers' : 'Companion ready' : 'Connect companion'}</Text>
          <Text style={styles.subtitle}>
            {pairedServer ? activeTab === 'containers' ? 'Browse cached storage or scan a container label.' : 'Your household will stay close, even when the signal does not.' : 'Pair this phone with your household to get started.'}
          </Text>
          {busy ? (
            <ActivityIndicator style={styles.activity} color="#166534" size="large" />
          ) : pairedServer && activeTab === 'home' ? (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}><View><Text style={styles.eyebrow}>Connected household</Text><Text style={styles.cardTitle}>{pairedServer.instanceName}</Text></View><Pressable accessibilityLabel="Sync inventory" disabled={syncing} onPress={() => void refreshInventory()} style={styles.refreshButton}><RefreshCw color="#4f46e5" size={18} /></Pressable></View>
              <Text style={styles.description}>{inventory.areas.length} areas · {inventory.containers.length} containers{inventory.syncedAt ? ` · Synced ${new Date(inventory.syncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actionGrid}>
                <Pressable onPress={() => void openScanner('container')} style={styles.actionTile}><QrCode color="#4f46e5" size={21} /><Text style={styles.actionLabel}>Scan</Text><Text style={styles.actionMeta}>Find a container</Text></Pressable>
                <View style={styles.actionTile}><PackagePlus color="#4f46e5" size={21} /><Text style={styles.actionLabel}>Add item</Text><Text style={styles.actionMeta}>Coming next</Text></View>
                <Pressable onPress={() => setActiveTab('containers')} style={styles.actionTile}><Search color="#4f46e5" size={21} /><Text style={styles.actionLabel}>Browse</Text><Text style={styles.actionMeta}>Areas and containers</Text></Pressable>
                <View style={styles.actionTile}><ArrowRightLeft color="#4f46e5" size={21} /><Text style={styles.actionLabel}>Transfer</Text><Text style={styles.actionMeta}>Coming next</Text></View>
              </View>
              <Pressable style={styles.secondaryButton} onPress={() => void forget()}>
                <Text style={styles.secondaryButtonText}>Forget this server</Text>
              </Pressable>
            </View>
          ) : pairedServer ? (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}><Text style={styles.eyebrow}>{selectedContainer ? 'Scanned container' : 'Cached inventory'}</Text><Pressable accessibilityLabel="Sync inventory" disabled={syncing} onPress={() => void refreshInventory()} style={styles.refreshButton}><RefreshCw color="#4f46e5" size={18} /></Pressable></View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {selectedContainer ? (
                <View style={styles.selectedContainerCard}>
                  <View style={styles.containerIcon}><Box color="#4f46e5" size={22} /></View>
                  <View style={styles.containerCopy}><Text style={styles.containerName}>{selectedContainer.name}</Text><Text style={styles.containerMeta}>{selectedContainer.code} · {selectedContainer.container_type.replace('_', ' ')}</Text></View>
                  <Pressable onPress={() => setSelectedContainer(null)}><Text style={styles.clearText}>Clear</Text></Pressable>
                </View>
              ) : null}
              {inventory.areas.map((area) => {
                const areaZones = inventory.zones.filter((zone) => zone.area_id === area.id)
                const areaContainers = inventory.containers.filter((container) => container.area_id === area.id)
                return (
                  <View key={area.id} style={styles.areaSection}>
                    <View style={styles.areaHeading}><MapPin color="#4f46e5" size={18} /><View><Text style={styles.areaName}>{area.name}</Text><Text style={styles.areaMeta}>{areaZones.length} zones · {areaContainers.length} containers</Text></View></View>
                    {areaContainers.map((container) => <Pressable key={container.id} onPress={() => setSelectedContainer(container)} style={styles.containerRow}><Box color="#667085" size={18} /><View style={styles.containerCopy}><Text style={styles.containerName}>{container.name}</Text><Text style={styles.containerMeta}>{container.code}{container.zone_id ? ` · ${areaZones.find((zone) => zone.id === container.zone_id)?.name ?? 'Zone'}` : ''}</Text></View></Pressable>)}
                  </View>
                )
              })}
              {!inventory.areas.length ? <Text style={styles.emptyInventory}>No cached locations yet. Connect to the server and sync.</Text> : null}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.eyebrow}>One-time setup</Text>
              <Text style={styles.cardTitle}>Pair this device</Text>
              <Text style={styles.description}>
                Scan the one-time QR code, or paste its WhereHouse pairing link below.
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setPairingUri}
                placeholder="wherehouse://pair?..."
                style={styles.input}
                value={pairingUri}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={() => void openScanner('pairing')} style={styles.scanButton}>
                <View style={styles.buttonContent}><QrCode color="#fff" size={18} strokeWidth={2.5} /><Text style={styles.scanButtonText}>Scan QR code</Text></View>
              </Pressable>
              <Pressable
                disabled={!pairingUri.trim()}
                onPress={() => void pair()}
                style={[styles.button, !pairingUri.trim() && styles.buttonDisabled]}
              >
                <Text style={styles.buttonText}>Pair device</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
        {pairedServer ? (
          <View style={styles.bottomNav}>
            <Pressable onPress={() => setActiveTab('home')} style={styles.navTab}><House color={activeTab === 'home' ? '#4f46e5' : '#667085'} size={17} strokeWidth={activeTab === 'home' ? 2.5 : 2} /><Text style={activeTab === 'home' ? styles.navLabelActive : styles.navLabel}>Home</Text></Pressable>
            <Pressable onPress={() => setActiveTab('containers')} style={styles.navTab}><Box color={activeTab === 'containers' ? '#4f46e5' : '#667085'} size={17} /><Text style={activeTab === 'containers' ? styles.navLabelActive : styles.navLabel}>Containers</Text></Pressable>
            <Pressable onPress={() => void openScanner('container')} style={styles.scanTab}><QrCode color="#fff" size={21} strokeWidth={2.5} /></Pressable>
            <View style={styles.navTab}><Clock3 color="#667085" size={17} /><Text style={styles.navLabel}>Checkouts</Text></View>
            <View style={styles.navTab}><MoreHorizontal color="#667085" size={18} /><Text style={styles.navLabel}>More</Text></View>
          </View>
        ) : null}
        <StatusBar style="auto" />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, backgroundColor: '#f6f7fb' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#172554' },
  brand: { color: '#172554', fontSize: 18, fontWeight: '800' },
  syncPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 20, backgroundColor: '#e9f8ef' },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#239b56' },
  syncText: { color: '#167443', fontSize: 11, fontWeight: '700' },
  title: { marginTop: 28, fontSize: 38, lineHeight: 43, fontWeight: '800', letterSpacing: -1.5, color: '#101828' },
  subtitle: { marginTop: 8, maxWidth: 340, color: '#667085', fontSize: 16, lineHeight: 23 },
  activity: { marginTop: 40 },
  card: { marginTop: 24, padding: 20, borderWidth: 1, borderColor: '#e1e6ef', borderRadius: 14, backgroundColor: '#fff' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  refreshButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e1e6ef', borderRadius: 9, backgroundColor: '#f8f9fc' },
  eyebrow: { marginBottom: 8, color: '#4f46e5', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  cardTitle: { color: '#101828', fontSize: 21, fontWeight: '800' },
  description: { marginTop: 8, fontSize: 15, lineHeight: 22, color: '#667085' },
  input: { marginTop: 18, padding: 13, borderWidth: 1, borderColor: '#cfd5df', borderRadius: 10, backgroundColor: '#fff' },
  error: { marginTop: 10, color: '#b42318' },
  button: { marginTop: 10, padding: 14, borderRadius: 10, backgroundColor: '#172554', alignItems: 'center' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { marginTop: 20, paddingVertical: 10 },
  secondaryButtonText: { color: '#667085', fontWeight: '700' },
  scanButton: { marginTop: 16, padding: 14, borderRadius: 10, backgroundColor: '#239b56', alignItems: 'center' },
  scanButtonText: { color: '#fff', fontWeight: '800' },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  actionTile: { flexGrow: 1, flexBasis: '46%', minHeight: 96, padding: 13, borderWidth: 1, borderColor: '#e4e7ec', borderRadius: 11, backgroundColor: '#fafbfc' },
  actionLabel: { marginTop: 8, color: '#101828', fontSize: 14, fontWeight: '800' },
  actionMeta: { marginTop: 2, color: '#98a2b3', fontSize: 10 },
  selectedContainerCard: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 11, padding: 12, backgroundColor: '#f3f4ff' },
  containerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#e8eaff' },
  containerCopy: { flex: 1, minWidth: 0 },
  containerName: { color: '#101828', fontSize: 14, fontWeight: '800' },
  containerMeta: { marginTop: 3, color: '#667085', fontSize: 11, textTransform: 'capitalize' },
  clearText: { color: '#4f46e5', fontSize: 11, fontWeight: '700' },
  areaSection: { marginTop: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e4e7ec', borderRadius: 11 },
  areaHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, backgroundColor: '#f8f9fc' },
  areaName: { color: '#101828', fontSize: 14, fontWeight: '800' },
  areaMeta: { marginTop: 2, color: '#98a2b3', fontSize: 10 },
  containerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#e4e7ec', padding: 12, backgroundColor: '#fff' },
  emptyInventory: { paddingVertical: 30, color: '#667085', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  bottomNav: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#e4e7ec', paddingTop: 8, paddingBottom: 6, paddingHorizontal: 12, backgroundColor: '#fff', shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8 },
  navTab: { flex: 1, minWidth: 54, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navLabel: { color: '#667085', fontSize: 10 },
  navLabelActive: { color: '#4f46e5', fontSize: 10, fontWeight: '700' },
  scanTab: { width: 52, height: 52, marginHorizontal: 12, marginTop: -32, borderWidth: 4, borderColor: '#fff', borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#239b56', shadowColor: '#101828', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 10 },
  scannerScreen: { flex: 1, backgroundColor: '#07120c' },
  scannerOverlay: { flex: 1, justifyContent: 'space-between', padding: 24, backgroundColor: 'rgba(4, 15, 9, 0.28)' },
  scannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scannerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  closeButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  closeButtonText: { color: '#fff', fontWeight: '700' },
  finder: { alignSelf: 'center', width: 260, height: 260, borderWidth: 3, borderColor: '#4ade80', borderRadius: 24, backgroundColor: 'transparent' },
  scannerHelp: { alignSelf: 'center', maxWidth: 300, color: '#fff', fontSize: 16, lineHeight: 23, textAlign: 'center', fontWeight: '600' },
})
