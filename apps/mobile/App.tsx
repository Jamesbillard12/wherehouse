import { useCameraPermissions } from 'expo-camera'
import { StatusBar } from 'expo-status-bar'
import { createRemoteClient, type StorageContainer } from '@wherehouse/api-client'
import { useEffect, useState } from 'react'
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
  const [activeTab, setActiveTab] = useState<MobileTab>('home')
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
    return <ScannerScreen mode={scannerMode} onCancel={() => setScannerMode(null)} onError={setError} onScan={(data) => { setError(null); setScannerMode(null); if (scannerMode === 'pairing') setPairingUri(data); else void openContainerCode(data) }} />
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppHeader connected={Boolean(pairedServer)} />
          <Text style={styles.title}>{pairedServer ? activeTab === 'containers' ? 'Containers' : 'Companion ready' : 'Connect companion'}</Text>
          <Text style={styles.subtitle}>
            {pairedServer ? activeTab === 'containers' ? 'Browse cached storage or scan a container label.' : 'Your household will stay close, even when the signal does not.' : 'Pair this phone with your household to get started.'}
          </Text>
          {busy ? (
            <ActivityIndicator style={styles.activity} color="#166534" size="large" />
          ) : pairedServer && activeTab === 'home' ? <HomeScreen error={error} inventory={inventory} onBrowse={() => setActiveTab('containers')} onForget={() => void forget()} onRefresh={() => void refreshInventory()} onScan={() => void openScanner('container')} server={pairedServer} syncing={syncing} />
            : pairedServer ? <ContainersScreen error={error} inventory={inventory} onRefresh={() => void refreshInventory()} onSelect={setSelectedContainer} selected={selectedContainer} syncing={syncing} />
              : <PairingScreen error={error} onChange={setPairingUri} onPair={() => void pair()} onScan={() => void openScanner('pairing')} value={pairingUri} />}
        </ScrollView>
        {pairedServer ? (
          <BottomNavigation activeTab={activeTab} onScan={() => void openScanner('container')} onSelect={setActiveTab} />
        ) : null}
        <StatusBar style="auto" />
      </View>
    </SafeAreaView>
  )
}
