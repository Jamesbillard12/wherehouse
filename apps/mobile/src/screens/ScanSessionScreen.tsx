import type { IdentifierResolution } from '@wherehouse/api-client'
import { CameraView } from 'expo-camera'
import { Check, Package, Radio } from 'lucide-react-native'
import { useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { styles } from '../theme/styles'

export function ScanSessionScreen({ entries, onClose, onNfc, onOpen, onQr }: {
  entries: IdentifierResolution[]
  onClose: () => void
  onNfc: () => Promise<void>
  onOpen: (entry: IdentifierResolution) => void
  onQr: (value: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accepting = useRef(true)
  const seenValues = useRef(new Set<string>())

  async function scan(value: string) {
    if (!accepting.current || seenValues.current.has(value)) return
    accepting.current = false
    setBusy(true)
    setError(null)
    try { await onQr(value); seenValues.current.add(value) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Code could not be resolved.') }
    finally {
      setBusy(false)
      setTimeout(() => { accepting.current = true }, 900)
    }
  }

  async function tapNfc() {
    setBusy(true)
    setError(null)
    try { await onNfc() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'NFC tag could not be resolved.') }
    finally { setBusy(false) }
  }

  return <View style={styles.scannerScreen}>
    <CameraView barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => void scan(data)} style={styles.scannerCamera} />
    <SafeAreaView style={styles.scannerOverlay}>
      <View style={styles.scannerHeader}><View><Text style={styles.scannerTitle}>Scan session</Text><Text style={styles.scannerHelp}>{entries.length} unique {entries.length === 1 ? 'target' : 'targets'} scanned</Text></View><Pressable accessibilityLabel="Finish scan session" onPress={onClose} style={styles.closeButton}><Check color="#fff" size={18} /><Text style={styles.closeButtonText}>Done</Text></Pressable></View>
      <View style={styles.finder} />
      {busy ? <ActivityIndicator color="#fff" /> : <Pressable onPress={() => void tapNfc()} style={styles.secondaryButton}><Radio color="#4f46e5" size={18} /><Text style={styles.secondaryButtonText}>Add by NFC</Text></Pressable>}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView style={{ maxHeight: 220 }}>
        {entries.map((entry) => {
          const target = entry.item ?? entry.container
          return <Pressable key={entry.identifier.id} onPress={() => onOpen(entry)} style={styles.containerRow}><Package color="#4f46e5" size={18} /><View style={styles.containerCopy}><Text style={styles.containerName}>{target?.name ?? 'Unknown target'}</Text><Text style={styles.containerMeta}>{entry.identifier.target_type} · {entry.item?.code ?? entry.container?.code}</Text></View></Pressable>
        })}
      </ScrollView>
      {!entries.length ? <Text style={styles.scannerHelp}>Scan QR labels continuously, or tap Add by NFC.</Text> : null}
    </SafeAreaView>
  </View>
}
