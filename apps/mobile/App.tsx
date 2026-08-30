import { CameraView, useCameraPermissions } from 'expo-camera'
import { StatusBar } from 'expo-status-bar'
import {
  ArrowRightLeft,
  Box,
  Clock3,
  House,
  MoreHorizontal,
  PackagePlus,
  QrCode,
  Search,
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

export default function App() {
  const [pairingUri, setPairingUri] = useState('')
  const [pairedServer, setPairedServer] = useState<PairedServer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  useEffect(() => {
    void loadPairedServer().then(setPairedServer).finally(() => setBusy(false))
    void Linking.getInitialURL().then((url) => url?.startsWith('wherehouse://') && setPairingUri(url))
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('wherehouse://')) setPairingUri(url)
    })
    return () => subscription.remove()
  }, [])

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
    await forgetPairedServer()
    setPairedServer(null)
    setBusy(false)
  }

  async function openScanner() {
    setError(null)
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission()
      if (!permission.granted) {
        setError('Camera access is required to scan a pairing code.')
        return
      }
    }
    setScanning(true)
  }

  if (scanning) {
    return (
      <View style={styles.scannerScreen}>
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (!data.startsWith('wherehouse://pair?')) {
              setError('That QR code is not a WhereHouse pairing code.')
              setScanning(false)
              return
            }
            setPairingUri(data)
            setError(null)
            setScanning(false)
          }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.scannerOverlay}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan pairing code</Text>
            <Pressable onPress={() => setScanning(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
          <View style={styles.finder} />
          <Text style={styles.scannerHelp}>Center the QR code shown in WhereHouse web.</Text>
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
          <Text style={styles.title}>{pairedServer ? 'Companion ready' : 'Connect companion'}</Text>
          <Text style={styles.subtitle}>
            {pairedServer ? 'Your household will stay close, even when the signal does not.' : 'Pair this phone with your household to get started.'}
          </Text>
          {busy ? (
            <ActivityIndicator style={styles.activity} color="#166534" size="large" />
          ) : pairedServer ? (
            <View style={styles.card}>
              <Text style={styles.eyebrow}>Connected household</Text>
              <Text style={styles.cardTitle}>{pairedServer.instanceName}</Text>
              <Text style={styles.description}>{pairedServer.baseUrl}</Text>
              <View style={styles.actionGrid}>
                <View style={styles.actionTile}><QrCode color="#4f46e5" size={21} /><Text style={styles.actionLabel}>Scan</Text><Text style={styles.actionMeta}>Coming next</Text></View>
                <View style={styles.actionTile}><PackagePlus color="#4f46e5" size={21} /><Text style={styles.actionLabel}>Add item</Text><Text style={styles.actionMeta}>Coming next</Text></View>
                <View style={styles.actionTile}><Search color="#4f46e5" size={21} /><Text style={styles.actionLabel}>Find item</Text><Text style={styles.actionMeta}>Coming next</Text></View>
                <View style={styles.actionTile}><ArrowRightLeft color="#4f46e5" size={21} /><Text style={styles.actionLabel}>Transfer</Text><Text style={styles.actionMeta}>Coming next</Text></View>
              </View>
              <Pressable style={styles.secondaryButton} onPress={() => void forget()}>
                <Text style={styles.secondaryButtonText}>Forget this server</Text>
              </Pressable>
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
              <Pressable onPress={() => void openScanner()} style={styles.scanButton}>
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
            <View style={styles.navTab}><House color="#4f46e5" size={17} strokeWidth={2.5} /><Text style={styles.navLabelActive}>Home</Text></View>
            <View style={styles.navTab}><Box color="#667085" size={17} /><Text style={styles.navLabel}>Items</Text></View>
            <View style={styles.scanTab}><QrCode color="#fff" size={21} strokeWidth={2.5} /></View>
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
