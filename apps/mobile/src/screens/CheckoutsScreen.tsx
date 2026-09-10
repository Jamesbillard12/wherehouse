import { checkoutItem, listCheckouts, returnCheckout, type Checkout } from '@wherehouse/api-client'
import { RotateCcw } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'

import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Text } from '../components/ui/text'
import type { CachedInventory } from '../services/inventory'
import type { PairedServer } from '../services/pairing'

export function CheckoutsScreen({ inventory, server }: { inventory: CachedInventory; server: PairedServer }) {
  const [entries, setEntries] = useState<Checkout[]>([])
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => { void listCheckouts(server.accessToken, server.workspaceId, 'active', server.baseUrl).then(setEntries).catch((reason) => setError(reason instanceof Error ? reason.message : 'Checkouts could not be loaded.')) }, [revision, server])
  const unavailable = new Set(entries.map((entry) => entry.item_id))
  return <View className="gap-3"><Text variant="muted">Your active loans and checkout history are tied to your borrower profile. Checkout and return require a connection.</Text>{error ? <Text accessibilityRole="alert" variant="error">{error}</Text> : null}
    {entries.map((entry) => <Card className="gap-2" key={entry.id}><Text variant="heading">{entry.item_name}</Text><Text variant="muted">Checked out {new Date(entry.checked_out_at).toLocaleDateString()}{entry.due_at ? ` · Due ${new Date(entry.due_at).toLocaleDateString()}` : ''}</Text><Button onPress={() => void returnCheckout(server.accessToken, entry.id, null, server.baseUrl).then(() => setRevision((v) => v + 1))} variant="outline"><RotateCcw size={18} /><Text>Return item</Text></Button></Card>)}
    <Card className="gap-2"><Text variant="heading">Check out to me</Text><Text variant="muted">Choose an available whole item.</Text>{inventory.items.filter((item) => !item.is_archived && !unavailable.has(item.id)).map((item) => <Pressable accessibilityRole="radio" key={item.id} onPress={() => setSelectedItem(item.id)}><Text className={selectedItem === item.id ? 'font-extrabold text-primary' : ''}>{item.name}</Text></Pressable>)}<Button disabled={!selectedItem} onPress={() => selectedItem && void checkoutItem(server.accessToken, server.workspaceId, { item_id: selectedItem }, server.baseUrl).then(() => { setSelectedItem(null); setRevision((v) => v + 1) })}><Text className="font-bold text-primary-foreground">Confirm checkout</Text></Button></Card>
  </View>
}
