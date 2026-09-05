import type { OverviewInventory } from '../dashboard/useOverviewInventory'
import type { Item } from '@wherehouse/api-client'
import { Check, ClipboardList, Pencil } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { ItemDetailsModal, itemLocation } from './ItemsView'

export function CompanionReviewQueue({ inventory, itemIds, onClose, onReviewed, onUpdated, token }: { inventory: OverviewInventory; itemIds: string[]; onClose: () => void; onReviewed: (itemId: string) => void; onUpdated: (item: Item) => void; token: string }) {
  const [reviewing, setReviewing] = useState<Item | null>(null)
  const items = itemIds.map((id) => inventory.items.find((item) => item.id === id)).filter((item): item is Item => Boolean(item))
  if (reviewing) return <ItemDetailsModal areas={inventory.areas} containerPlacements={inventory.containerPlacements} containers={inventory.containers} item={reviewing} locationLabel={itemLocation(inventory.itemPlacements.find((entry) => entry.item_id === reviewing.id), inventory.areas, inventory.zones, inventory.containers, inventory.containerPlacements)} onClose={() => { onReviewed(reviewing.id); setReviewing(null) }} onDeleted={(itemId) => { onReviewed(itemId); setReviewing(null) }} onUpdated={(item) => { setReviewing(item); onUpdated(item) }} placement={inventory.itemPlacements.find((entry) => entry.item_id === reviewing.id)} token={token} zones={inventory.zones} />
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="location-dialog review-queue-dialog max-w-[calc(100%-3rem)] gap-0 overflow-y-auto p-0 sm:max-w-[720px]" showCloseButton={false}><DialogHeader className="dialog-heading flex-row"><div><p className="eyebrow">Companion capture</p><DialogTitle>Review new items</DialogTitle><DialogDescription>{itemIds.length} {itemIds.length === 1 ? 'item needs' : 'items need'} review</DialogDescription></div><DialogClose aria-label="Close review queue" render={<Button size="icon" variant="secondary" />}>×</DialogClose></DialogHeader><div className="review-queue-list">{items.map((item) => <article key={item.id}><span className="review-item-icon"><ClipboardList aria-hidden="true" /></span><span><strong>{item.name}</strong><small>{item.code} · {itemLocation(inventory.itemPlacements.find((entry) => entry.item_id === item.id), inventory.areas, inventory.zones, inventory.containers, inventory.containerPlacements)}</small></span><Button variant="outline" onClick={() => setReviewing(item)}><Pencil aria-hidden="true" /> Review</Button><Button aria-label={`Mark ${item.name} reviewed`} className="review-done" onClick={() => onReviewed(item.id)} title="Mark reviewed"><Check aria-hidden="true" /></Button></article>)}{!items.length && inventory.loading ? <p className="review-loading">Loading new items…</p> : null}</div><DialogFooter className="dialog-actions"><DialogClose render={<Button variant="outline" />}>Review later</DialogClose></DialogFooter></DialogContent></Dialog>
}
