import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.brand}>WhereHouse</Text>
        <Text style={styles.title}>Companion</Text>
        {busy ? (
          <ActivityIndicator style={styles.activity} color="#166534" size="large" />
        ) : pairedServer ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Paired with {pairedServer.instanceName}</Text>
            <Text style={styles.description}>{pairedServer.baseUrl}</Text>
            <Text style={styles.note}>Ready to cache inventory and queue offline changes.</Text>
            <Pressable style={styles.secondaryButton} onPress={() => void forget()}>
              <Text style={styles.secondaryButtonText}>Forget this server</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
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
            <Pressable
              disabled={!pairingUri.trim()}
              onPress={() => void pair()}
              style={[styles.button, !pairingUri.trim() && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>Pair device</Text>
            </Pressable>
          </View>
        )}
        <StatusBar style="auto" />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f6f8f6' },
  container: { flex: 1, justifyContent: 'center', padding: 28 },
  brand: { color: '#166534', fontSize: 18, fontWeight: '700' },
  title: { marginTop: 8, fontSize: 48, fontWeight: '800', letterSpacing: -2, color: '#17211b' },
  activity: { marginTop: 40 },
  card: { marginTop: 28, padding: 20, borderRadius: 14, backgroundColor: '#e8f5eb' },
  cardTitle: { color: '#17211b', fontSize: 20, fontWeight: '700' },
  description: { marginTop: 10, fontSize: 16, lineHeight: 23, color: '#536158' },
  note: { marginTop: 14, color: '#166534', fontWeight: '600' },
  input: { marginTop: 18, padding: 13, borderWidth: 1, borderColor: '#9db7a3', borderRadius: 10, backgroundColor: '#fff' },
  error: { marginTop: 10, color: '#b42318' },
  button: { marginTop: 16, padding: 14, borderRadius: 10, backgroundColor: '#166534', alignItems: 'center' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { marginTop: 20, paddingVertical: 10 },
  secondaryButtonText: { color: '#166534', fontWeight: '700' },
})
