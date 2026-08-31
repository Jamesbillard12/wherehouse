import type { Item } from '@wherehouse/api-client'
import { Package, Search } from 'lucide-react-native'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useState } from 'react'

import type { CachedInventory } from '../services/inventory'
import { styles } from '../theme/styles'
import { placementLocationChoice } from '../utils/itemLocations'

export function ItemsScreen({ inventory, onEdit }: { inventory: CachedInventory; onEdit: (item: Item) => void }) {
  const [query, setQuery] = useState('')
  const items = inventory.items.filter((item) => !item.is_archived && `${item.name} ${item.code} ${item.manufacturer ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <View style={styles.itemsPanel}><View style={styles.itemSearch}><Search color="#98a2b3" size={18} /><TextInput onChangeText={setQuery} placeholder="Search items" style={styles.itemSearchInput} value={query} /></View>{items.length ? items.map((item) => { const location = placementLocationChoice(inventory.itemPlacements.find((entry) => entry.item_id === item.id), inventory); return <Pressable key={item.id} onPress={() => onEdit(item)} style={styles.itemListRow}><View style={styles.itemListIcon}><Package color="#4f46e5" size={20} /></View><View style={styles.itemListCopy}><Text style={styles.itemListName}>{item.name}</Text><Text style={styles.itemListMeta}>{[item.code, location?.label, Number(item.quantity) !== 1 ? `Qty ${item.quantity}` : ''].filter(Boolean).join(' · ')}</Text></View><Text style={styles.editItemText}>Edit</Text></Pressable> }) : <Text style={styles.emptyInventory}>{query ? 'No matching items.' : 'No items yet. Use the green + button to add one.'}</Text>}</View>
}
