import { Minus, Plus } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'

import { styles } from '../theme/styles'

export function QuantityStepper({ onChange, value }: { onChange: (value: number) => void; value: number }) {
  return <View style={styles.quantityStepper}><Pressable accessibilityLabel="Decrease quantity" disabled={value <= 1} onPress={() => onChange(Math.max(1, value - 1))} style={styles.quantityButton}><Minus color="#4f46e5" size={18} /></Pressable><Text style={styles.quantityValue}>{value}</Text><Pressable accessibilityLabel="Increase quantity" onPress={() => onChange(value + 1)} style={styles.quantityButton}><Plus color="#4f46e5" size={18} /></Pressable></View>
}
