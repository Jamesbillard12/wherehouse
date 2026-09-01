import { Image, Text, View } from 'react-native'

import { styles } from '../theme/styles'

export function AppHeader({ connected }: { connected: boolean }) {
  return <View style={styles.brandRow}><Image accessibilityLabel="WhereHouse" resizeMode="contain" source={require('../../../web/public/logo.png')} style={styles.brandLogo} />{connected ? <View style={styles.syncPill}><View style={styles.syncDot} /><Text style={styles.syncText}>Connected</Text></View> : null}</View>
}
