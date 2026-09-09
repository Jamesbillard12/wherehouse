import type { IdentifierMedium } from '@wherehouse/api-client'
import { QrCode, Radio } from 'lucide-react-native'
import { Text, View } from 'react-native'

import { styles } from '../../theme/styles'

export function PhysicalIdentifierStatus({ media }: { media: IdentifierMedium[] }) {
  if (!media.length) return <Text style={styles.itemListMeta}>No active QR or NFC tag</Text>
  return (
    <View accessibilityLabel={`Active physical identifiers: ${media.join(' and ')}`} style={styles.identifierStatusRow}>
      <Text style={styles.itemListMeta}>Active:</Text>
      {media.includes('qr') ? <View style={styles.identifierStatusBadge}><QrCode color="#166534" size={14} /><Text style={styles.identifierStatusText}>QR</Text></View> : null}
      {media.includes('nfc') ? <View style={styles.identifierStatusBadge}><Radio color="#166534" size={14} /><Text style={styles.identifierStatusText}>NFC</Text></View> : null}
    </View>
  )
}
