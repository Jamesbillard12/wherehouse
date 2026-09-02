import { Camera, Image as ImageIcon } from 'lucide-react-native'
import { Image, Pressable, Text, View } from 'react-native'

import { styles } from '../../theme/styles'

export function ItemPhotoField({ emptyHint, onCamera, onLibrary, uri }: { emptyHint: string; onCamera: () => void; onLibrary: () => void; uri?: string }) {
  return <View style={styles.photoPanel}>
    {uri ? <Image source={{ uri }} style={styles.itemPhoto} /> : <View style={styles.photoPlaceholder}><ImageIcon color="#98a2b3" size={32} /><Text style={styles.photoPrompt}>{emptyHint}</Text><Text style={styles.photoHint}>Useful for recognition and finding it later.</Text></View>}
    <View style={styles.photoActions}>
      <Pressable accessibilityLabel="Take item photo" onPress={onCamera} style={styles.photoButtonPrimary}><Camera color="#fff" size={18} /><Text style={styles.photoButtonPrimaryText}>{uri ? 'Retake' : 'Take photo'}</Text></Pressable>
      <Pressable accessibilityLabel="Choose item photo from library" onPress={onLibrary} style={styles.photoButton}><ImageIcon color="#4f46e5" size={18} /><Text style={styles.photoButtonText}>Library</Text></Pressable>
    </View>
  </View>
}
