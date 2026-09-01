import { CameraView } from 'expo-camera'
import { StatusBar } from 'expo-status-bar'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { styles } from '../theme/styles'

type ScannerMode = 'pairing' | 'identify' | 'item-location'

export function ScannerScreen({ mode, onCancel, onError, onScan }: {
  mode: ScannerMode
  onCancel: () => void
  onError: (message: string) => void
  onScan: (value: string) => void
}) {
  return (
    <View style={styles.scannerScreen}>
      <CameraView barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => {
        if (mode === 'pairing' && !data.startsWith('wherehouse://pair?')) {
          onError('That QR code is not a WhereHouse pairing code.')
          onCancel()
          return
        }
        onScan(data)
      }} style={styles.scannerCamera} />
      <SafeAreaView style={styles.scannerOverlay}>
        <View style={styles.scannerHeader}>
          <Text style={styles.scannerTitle}>{mode === 'pairing' ? 'Scan pairing code' : mode === 'item-location' ? 'Choose item location' : 'Identify'}</Text>
          <Pressable onPress={onCancel} style={styles.closeButton}><Text style={styles.closeButtonText}>Close</Text></Pressable>
        </View>
        <View style={styles.finder} />
        <Text style={styles.scannerHelp}>{mode === 'pairing' ? 'Center the QR code shown in WhereHouse web.' : mode === 'item-location' ? 'Scan the container where this item will be stored.' : 'Center a WhereHouse item or container label.'}</Text>
      </SafeAreaView>
      <StatusBar style="light" />
    </View>
  )
}
