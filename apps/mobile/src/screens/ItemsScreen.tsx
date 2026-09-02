import type { Item, ItemSearchResult } from '@wherehouse/api-client'
import { Package, RefreshCw, Search } from 'lucide-react-native'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useEffect, useMemo, useState } from 'react'

import type { CachedInventory } from '../services/inventory'
import { styles } from '../theme/styles'
import { placementLocationChoice } from '../utils/itemLocations'

export function ItemsScreen({ error, householdId, inventory, onEdit, onRefresh, search, syncing }: { error: string | null; householdId: string; inventory: CachedInventory; onEdit: (item: Item) => void; onRefresh: () => void; search: (query: string) => Promise<ItemSearchResult[]>; syncing: boolean }) {
  const [query, setQuery] = useState('')
  const [remoteResults, setRemoteResults] = useState<ItemSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  useEffect(() => { setQuery(''); setRemoteResults(null) }, [householdId])
  const localResults = useMemo(() => { const term = query.trim().toLocaleLowerCase(); return inventory.items.filter((item) => !item.is_archived && `${item.name} ${item.code} ${item.manufacturer ?? ''} ${item.model ?? ''}`.toLocaleLowerCase().includes(term)).map((item) => ({ item, resolved_path: placementLocationChoice(inventory.itemPlacements.find((entry) => entry.item_id === item.id), inventory)?.detail ?? null })) }, [inventory, query])
  useEffect(() => { const term = query.trim(); if (!term) { setRemoteResults(null); setSearching(false); return }; let cancelled = false; setSearching(true); const timer = setTimeout(() => void search(term).then((results) => { if (!cancelled) setRemoteResults(results) }).catch(() => { if (!cancelled) setRemoteResults(null) }).finally(() => { if (!cancelled) setSearching(false) }), 250); return () => { cancelled = true; clearTimeout(timer) } }, [query, search])
  const results = query.trim() ? remoteResults ?? localResults : localResults
  return <View style={styles.itemsPanel}><View style={styles.cardHeaderRow}><View style={styles.itemSearch}><Search color="#98a2b3" size={18} /><TextInput autoCapitalize="none" clearButtonMode="while-editing" maxLength={200} onChangeText={setQuery} placeholder="Search items and locations" returnKeyType="search" style={styles.itemSearchInput} value={query} /></View><Pressable accessibilityLabel="Sync items" disabled={syncing} onPress={onRefresh} style={styles.refreshButton}><RefreshCw color="#4f46e5" size={18} /></Pressable></View>{error ? <Text style={styles.error}>{error}</Text> : null}{searching ? <Text style={styles.emptyInventory}>Searching…</Text> : null}{results.length ? results.map(({ item, resolved_path }) => { const location = placementLocationChoice(inventory.itemPlacements.find((entry) => entry.item_id === item.id), inventory); return <Pressable accessibilityLabel={`${location ? 'Edit' : 'Place'} ${item.name}`} key={item.id} onPress={() => onEdit(item)} style={styles.itemListRow}><View style={styles.itemListIcon}><Package color="#4f46e5" size={20} /></View><View style={styles.itemListCopy}><Text style={styles.itemListName}>{item.name}</Text><Text style={styles.itemListMeta}>{[item.code, resolved_path ?? location?.detail ?? location?.label ?? 'Unplaced', Number(item.quantity) !== 1 ? `Qty ${item.quantity}` : ''].filter(Boolean).join(' · ')}</Text></View><Text style={styles.editItemText}>{location ? 'Edit' : 'Place'}</Text></Pressable> }) : !searching ? <Text style={styles.emptyInventory}>{query ? 'No matching items. Try a name, brand, model, code, or location.' : 'No items yet. Use the green + button to add one.'}</Text> : null}</View>
}
