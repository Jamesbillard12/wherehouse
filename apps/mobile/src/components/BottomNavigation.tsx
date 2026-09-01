import { Box, House, MoreHorizontal, Package, PackagePlus, Plus, QrCode, Radio, X } from 'lucide-react-native'
import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'

import { styles } from '../theme/styles'

export type MobileTab = 'home' | 'containers' | 'add-item' | 'items' | 'more'

export function BottomNavigation({ activeTab, onAddItem, onLocations, onNfc, onScan, onSelect }: {
  activeTab: MobileTab
  onAddItem: () => void
  onLocations: () => void
  onNfc: () => void
  onScan: () => void
  onSelect: (tab: MobileTab) => void
}) {
  const [actionsOpen, setActionsOpen] = useState(false)
  function choose(action: () => void) { setActionsOpen(false); action() }
  return (
    <>
    <View style={styles.bottomNav}>
      <Pressable onPress={() => onSelect('home')} style={styles.navTab}><House color={activeTab === 'home' ? '#4f46e5' : '#667085'} size={17} strokeWidth={activeTab === 'home' ? 2.5 : 2} /><Text style={activeTab === 'home' ? styles.navLabelActive : styles.navLabel}>Home</Text></Pressable>
      <Pressable onPress={onLocations} style={styles.navTab}><Box color={activeTab === 'containers' ? '#4f46e5' : '#667085'} size={17} /><Text style={activeTab === 'containers' ? styles.navLabelActive : styles.navLabel}>Locations</Text></Pressable>
      <Pressable accessibilityHint="Opens app actions" accessibilityLabel="Open actions" onPress={() => setActionsOpen(true)} style={styles.scanTab}><Plus color="#fff" size={27} strokeWidth={2.8} /></Pressable>
      <Pressable onPress={() => onSelect('items')} style={styles.navTab}><Package color={activeTab === 'items' ? '#4f46e5' : '#667085'} size={17} /><Text style={activeTab === 'items' ? styles.navLabelActive : styles.navLabel}>Items</Text></Pressable>
      <Pressable onPress={() => onSelect('more')} style={styles.navTab}><MoreHorizontal color={activeTab === 'more' ? '#4f46e5' : '#667085'} size={18} /><Text style={activeTab === 'more' ? styles.navLabelActive : styles.navLabel}>More</Text></Pressable>
    </View>
    <Modal animationType="fade" onRequestClose={() => setActionsOpen(false)} transparent visible={actionsOpen}>
      <Pressable accessibilityRole="button" onPress={() => setActionsOpen(false)} style={styles.quickActionBackdrop}>
        <Pressable accessibilityRole="menu" onPress={(event) => event.stopPropagation()} style={styles.quickActionSheet}>
          <View style={styles.quickActionHeading}><View><Text style={styles.quickActionTitle}>What would you like to do?</Text><Text style={styles.quickActionSubtitle}>Add inventory or identify something nearby.</Text></View><Pressable accessibilityLabel="Close actions" onPress={() => setActionsOpen(false)}><X color="#667085" size={21} /></Pressable></View>
          <Pressable accessibilityRole="menuitem" onPress={() => choose(onAddItem)} style={styles.quickActionOption}><PackagePlus color="#4f46e5" size={22} /><View><Text style={styles.quickActionOptionTitle}>Add item</Text><Text style={styles.quickActionOptionMeta}>Create a new inventory item</Text></View></Pressable>
          <Pressable accessibilityRole="menuitem" onPress={() => choose(onScan)} style={styles.quickActionOption}><QrCode color="#239b56" size={22} /><View><Text style={styles.quickActionOptionTitle}>Scan QR</Text><Text style={styles.quickActionOptionMeta}>Start a multi-item scan session</Text></View></Pressable>
          <Pressable accessibilityRole="menuitem" onPress={() => choose(onNfc)} style={styles.quickActionOption}><Radio color="#239b56" size={22} /><View><Text style={styles.quickActionOptionTitle}>Tap NFC</Text><Text style={styles.quickActionOptionMeta}>Read a nearby WhereHouse tag</Text></View></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  )
}
