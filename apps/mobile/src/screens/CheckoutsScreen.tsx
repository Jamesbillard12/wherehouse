import { abandonCheckoutSession, completeCheckoutSession, getCurrentCheckoutSession, listCheckouts, removeCheckoutSessionItem, returnCheckout, subscribeToWorkspace, type Checkout, type CheckoutSession } from '@wherehouse/api-client'
import { QrCode, Radio, RotateCcw, ShoppingCart, Trash2, X } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Text } from '../components/ui/text'
import type { PairedServer } from '../services/pairing'

export function CheckoutsScreen({ onNfc, onScan, server }: { onNfc: () => void; onScan: () => void; server: PairedServer }) {
  const [session, setSession] = useState<CheckoutSession | null>(null)
  const [activeLoans, setActiveLoans] = useState<Checkout[]>([])
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => { void Promise.all([getCurrentCheckoutSession(server.accessToken, server.workspaceId, server.baseUrl), listCheckouts(server.accessToken, server.workspaceId, 'active', server.baseUrl)]).then(([nextSession, loans]) => { setSession(nextSession); setActiveLoans(loans) }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Checkout could not be loaded.')) }, [revision, server])
  useEffect(() => subscribeToWorkspace({
    baseUrl: server.baseUrl,
    workspaceId: server.workspaceId,
    token: server.accessToken,
    onEvent: (event) => {
      if (event.type.startsWith('checkout_session.') || event.type === 'inventory.changed') setRevision((value) => value + 1)
    },
  }), [server])
  async function complete() { try { setError(null); await completeCheckoutSession(server.accessToken, session!.id, session!.revision, server.baseUrl); setRevision((v) => v + 1) } catch (reason) { setError(`${reason instanceof Error ? reason.message : 'Checkout failed.'} Your checkout was not changed.`); setRevision((v) => v + 1) } }
  if (!session) return <Text variant="muted">Loading your checkout…</Text>
  return <View className="gap-3"><Text variant="muted">Scan items as you walk. This checkout is synchronized across your devices and remains until completed or cleared.</Text>{error ? <Text accessibilityRole="alert" variant="error">{error}</Text> : null}
    <Button onPress={onScan}><QrCode size={18} color="#fff" /><Text className="font-bold text-primary-foreground">Scan items</Text></Button>
    <Button onPress={onNfc} variant="outline"><Radio size={18} /><Text>Tap item NFC tag</Text></Button>
    {session.items.map((item) => <Card className="gap-2" key={item.id}><View className="flex-row items-center justify-between"><View><Text variant="heading">{item.item_name}</Text><Text variant="muted">{item.item_code}</Text></View><Button accessibilityLabel={`Remove ${item.item_name}`} onPress={() => void removeCheckoutSessionItem(server.accessToken, session.id, item.item_id, server.baseUrl).then(setSession)} size="icon" variant="ghost"><X size={18} /></Button></View>{item.availability !== 'available' ? <Text variant="error">{item.availability === 'checked_out' ? 'Unavailable — already checked out' : 'Also in another active checkout'}</Text> : null}</Card>)}
    {!session.items.length ? <Card><Text variant="muted">No items yet. Scan a QR/NFC tag to start.</Text></Card> : null}
    <Button disabled={!session.items.length || !session.borrower_profile_id || session.items.some((item) => item.availability === 'checked_out')} onPress={() => void complete()}><ShoppingCart size={18} color="#fff" /><Text className="font-bold text-primary-foreground">Check out {session.items.length} {session.items.length === 1 ? 'item' : 'items'}</Text></Button>
    <Button disabled={!session.items.length} onPress={() => void abandonCheckoutSession(server.accessToken, session.id, server.baseUrl).then(() => setRevision((v) => v + 1))} variant="outline"><Trash2 size={18} /><Text>Clear checkout</Text></Button>
    {activeLoans.length ? <><Text variant="heading">Items you can return</Text>{activeLoans.map((loan) => <Card className="gap-2" key={loan.id}><Text variant="heading">{loan.item_name}</Text><Text variant="muted">Checked out to {loan.borrower_name}</Text><Button onPress={() => void returnCheckout(server.accessToken, loan.id, null, server.baseUrl).then(() => setRevision((v) => v + 1))} variant="outline"><RotateCcw size={18} /><Text>Return item</Text></Button></Card>)}</> : null}
  </View>
}
