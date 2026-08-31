import { House } from 'lucide-react-native'
import { Text, View } from 'react-native'

import { styles } from '../theme/styles'

export function AppHeader({ connected }: { connected: boolean }) {
  return <View style={styles.brandRow}><View style={styles.brandLockup}><View style={styles.brandMark}><House color="#fff" size={17} strokeWidth={2.5} /></View><Text style={styles.brand}>WhereHouse</Text></View>{connected ? <View style={styles.syncPill}><View style={styles.syncDot} /><Text style={styles.syncText}>Connected</Text></View> : null}</View>
}
