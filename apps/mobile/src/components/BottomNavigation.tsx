import { Box, House, MoreHorizontal, Package, Plus } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'

import { styles } from '../theme/styles'

export type MobileTab = 'home' | 'containers' | 'add-item' | 'items'

export function BottomNavigation({ activeTab, onAddItem, onSelect }: {
  activeTab: MobileTab
  onAddItem: () => void
  onSelect: (tab: MobileTab) => void
}) {
  return (
    <View style={styles.bottomNav}>
      <Pressable onPress={() => onSelect('home')} style={styles.navTab}><House color={activeTab === 'home' ? '#4f46e5' : '#667085'} size={17} strokeWidth={activeTab === 'home' ? 2.5 : 2} /><Text style={activeTab === 'home' ? styles.navLabelActive : styles.navLabel}>Home</Text></Pressable>
      <Pressable onPress={() => onSelect('containers')} style={styles.navTab}><Box color={activeTab === 'containers' ? '#4f46e5' : '#667085'} size={17} /><Text style={activeTab === 'containers' ? styles.navLabelActive : styles.navLabel}>Containers</Text></Pressable>
      <Pressable accessibilityLabel="Add item" onPress={onAddItem} style={styles.scanTab}><Plus color="#fff" size={24} strokeWidth={2.8} /></Pressable>
      <Pressable onPress={() => onSelect('items')} style={styles.navTab}><Package color={activeTab === 'items' ? '#4f46e5' : '#667085'} size={17} /><Text style={activeTab === 'items' ? styles.navLabelActive : styles.navLabel}>Items</Text></Pressable>
      <View style={styles.navTab}><MoreHorizontal color="#667085" size={18} /><Text style={styles.navLabel}>More</Text></View>
    </View>
  )
}
