import { QrCode } from 'lucide-react-native'
import { Pressable, Text, TextInput, View } from 'react-native'

import { styles } from '../theme/styles'

export function PairingScreen({ error, onChange, onPair, onScan, value }: { error: string | null; onChange: (value: string) => void; onPair: () => void; onScan: () => void; value: string }) {
  return <View style={styles.card}><Text style={styles.eyebrow}>One-time setup</Text><Text style={styles.cardTitle}>Pair this device</Text><Text style={styles.description}>Scan the one-time QR code, or paste its WhereHouse pairing link below.</Text><TextInput autoCapitalize="none" autoCorrect={false} onChangeText={onChange} placeholder="wherehouse://pair?..." style={styles.input} value={value} />{error ? <Text style={styles.error}>{error}</Text> : null}<Pressable onPress={onScan} style={styles.scanButton}><View style={styles.buttonContent}><QrCode color="#fff" size={18} strokeWidth={2.5} /><Text style={styles.scanButtonText}>Scan QR code</Text></View></Pressable><Pressable disabled={!value.trim()} onPress={onPair} style={[styles.button, !value.trim() && styles.buttonDisabled]}><Text style={styles.buttonText}>Pair device</Text></Pressable></View>
}
