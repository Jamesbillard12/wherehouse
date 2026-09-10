import { checkoutItem, createBorrower, createBorrowerInvitation, listBorrowerInvitations, listBorrowers, listCheckouts, listItems, returnCheckout, revokeBorrowerInvitation, updateBorrower, type Borrower, type BorrowerInvitation, type Checkout, type CheckoutStatus, type Item, type Workspace } from '@wherehouse/api-client'
import QRCode from 'qrcode'
import { Clock3, Plus, RotateCcw, UserRound } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/wherehouse/PageHeader'
import { EmptyState, ErrorState, LoadingState, StatusMessage } from '@/components/wherehouse/StateDisplay'
import { message } from '@/shared/utils/errors'

export function CheckoutsView({ isOwner, token, workspace }: { isOwner: boolean; token: string; workspace: Workspace }) {
  const [tab, setTab] = useState<CheckoutStatus>('active')
  const [checkouts, setCheckouts] = useState<Checkout[]>([])
  const [borrowers, setBorrowers] = useState<Borrower[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [borrowerOpen, setBorrowerOpen] = useState(false)
  const [invitation, setInvitation] = useState<BorrowerInvitation | null>(null)
  const [invitations, setInvitations] = useState<BorrowerInvitation[]>([])
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null)
  const [qr, setQr] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([listCheckouts(token, workspace.id, tab), isOwner ? listBorrowers(token, workspace.id) : Promise.resolve([]), listItems(token, workspace.id), isOwner ? listBorrowerInvitations(token, workspace.id) : Promise.resolve([])])
      .then(([nextCheckouts, nextBorrowers, nextItems, nextInvitations]) => { if (!cancelled) { setCheckouts(nextCheckouts); setBorrowers(nextBorrowers); setItems(nextItems.filter((item) => !item.is_archived)); setInvitations(nextInvitations); setError(null) } })
      .catch((reason) => !cancelled && setError(message(reason)))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [isOwner, revision, tab, token, workspace.id])

  useEffect(() => { if (invitation?.invite_uri) void QRCode.toDataURL(invitation.invite_uri, { width: 280, margin: 1 }).then(setQr) }, [invitation])

  async function addBorrower(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    await createBorrower(token, workspace.id, { display_name: String(data.get('name')), email: String(data.get('email') || '') || null })
    setBorrowerOpen(false); setRevision((value) => value + 1)
  }
  async function createCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    await checkoutItem(token, workspace.id, { item_id: String(data.get('item')), borrower_profile_id: isOwner ? String(data.get('borrower')) : undefined, due_at: String(data.get('due') || '') ? new Date(String(data.get('due'))).toISOString() : null, notes: String(data.get('notes') || '') || null })
    setCheckoutOpen(false); setRevision((value) => value + 1)
  }
  async function editBorrower(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingBorrower) return; const data = new FormData(event.currentTarget)
    await updateBorrower(token, workspace.id, editingBorrower.id, { display_name: String(data.get('name')), email: String(data.get('email') || '') || null })
    setEditingBorrower(null); setRevision((value) => value + 1)
  }

  return <div className="feature-page"><PageHeader title="Checkouts" />
    <div className="flex flex-wrap gap-2">{(['active', 'overdue', 'history'] as const).map((value) => <Button key={value} onClick={() => setTab(value)} variant={tab === value ? 'default' : 'outline'}>{value[0].toUpperCase() + value.slice(1)}</Button>)}<Button onClick={() => setCheckoutOpen(true)}><Clock3 />{isOwner ? 'Check out item' : 'Check out to me'}</Button>{isOwner ? <Button onClick={() => setBorrowerOpen(true)} variant="outline"><Plus />Add borrower</Button> : null}</div>
    {error ? <ErrorState title="Checkouts are unavailable" description={error} action={<Button onClick={() => setRevision((v) => v + 1)}>Try again</Button>} /> : loading ? <LoadingState label="Loading checkouts…" /> : checkouts.length ? <div className="grid gap-3">{checkouts.map((entry) => <article className="rounded-xl border p-4" key={entry.id}><div className="flex items-start justify-between gap-3"><div><h3>{entry.item_name}</h3><p>{entry.borrower_name} · {entry.borrower_access_type === 'managed' ? 'Managed Borrower' : 'Self-Service Borrower'}</p><small>Checked out {new Date(entry.checked_out_at).toLocaleDateString()}{entry.due_at ? ` · Due ${new Date(entry.due_at).toLocaleDateString()}` : ''}</small>{entry.overdue ? <StatusMessage tone="warning">Overdue</StatusMessage> : null}</div>{!entry.returned_at ? <Button onClick={() => void returnCheckout(token, entry.id).then(() => setRevision((v) => v + 1))} variant="outline"><RotateCcw />Return</Button> : null}</div></article>)}</div> : <EmptyState icon={Clock3} title={`No ${tab} checkouts`} description="Whole items checked out from this household will appear here." />}
    {isOwner && borrowers.length ? <section><h2>Borrowers</h2><div className="grid gap-3">{borrowers.map((borrower) => { const activeInvite = invitations.find((entry) => entry.borrower_profile_id === borrower.id); return <article className="rounded-xl border p-4" key={borrower.id}><UserRound /><strong>{borrower.display_name}</strong><p>{borrower.access_type === 'managed' ? 'Managed Borrower' : 'Self-Service Borrower'}{borrower.email ? ` · ${borrower.email}` : ''}</p><Button onClick={() => setEditingBorrower(borrower)} variant="outline">Edit</Button>{activeInvite ? <><StatusMessage>Invitation expires {new Date(activeInvite.expires_at).toLocaleString()}</StatusMessage><Button onClick={() => void revokeBorrowerInvitation(token, workspace.id, activeInvite.id).then(() => setRevision((v) => v + 1))} variant="outline">Revoke invite</Button><Button onClick={() => void createBorrowerInvitation(token, workspace.id, borrower.id).then((next) => { setInvitation(next); setRevision((v) => v + 1) })} variant="outline">Reissue invite</Button></> : borrower.access_type === 'managed' && borrower.email ? <Button onClick={() => void createBorrowerInvitation(token, workspace.id, borrower.id).then((next) => { setInvitation(next); setRevision((v) => v + 1) })} variant="outline">Enable self-service</Button> : null}</article> })}</div></section> : null}
    <Dialog onOpenChange={setCheckoutOpen} open={checkoutOpen}><DialogContent><form onSubmit={(event) => void createCheckout(event)}><DialogHeader><DialogTitle>{isOwner ? 'Check out item' : 'Check out to me'}</DialogTitle><DialogDescription>Checkout is for the whole item. It remains in inventory while on loan.</DialogDescription></DialogHeader><label>Item<Select name="item" required><SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></label>{isOwner ? <label>Borrower<Select name="borrower" required><SelectTrigger><SelectValue placeholder="Select borrower" /></SelectTrigger><SelectContent>{borrowers.map((borrower) => <SelectItem key={borrower.id} value={borrower.id}>{borrower.display_name}</SelectItem>)}</SelectContent></Select></label> : null}<label>Due date (optional)<Input name="due" type="date" /></label><label>Note (optional)<Input name="notes" /></label><DialogFooter><Button type="submit">Confirm checkout</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog onOpenChange={setBorrowerOpen} open={borrowerOpen}><DialogContent><form onSubmit={(event) => void addBorrower(event)}><DialogHeader><DialogTitle>Add Borrower</DialogTitle><DialogDescription>Create a Managed Borrower. Email is only needed to enable self-service later.</DialogDescription></DialogHeader><label>Name<Input name="name" required /></label><label>Email (optional)<Input name="email" type="email" /></label><DialogFooter><Button type="submit">Create Borrower</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog onOpenChange={(open) => !open && setEditingBorrower(null)} open={Boolean(editingBorrower)}><DialogContent><form onSubmit={(event) => void editBorrower(event)}><DialogHeader><DialogTitle>Edit Borrower</DialogTitle><DialogDescription>Linked account emails require a separate identity change flow. Revoke an active invitation before changing its email.</DialogDescription></DialogHeader><label>Name<Input defaultValue={editingBorrower?.display_name} name="name" required /></label><label>Email (optional)<Input defaultValue={editingBorrower?.email ?? ''} name="email" type="email" /></label><DialogFooter><Button type="submit">Save changes</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog onOpenChange={(open) => !open && setInvitation(null)} open={Boolean(invitation)}><DialogContent><DialogHeader><DialogTitle>Self-service invitation</DialogTitle><DialogDescription>{invitation?.borrower_name} must sign in or create an account using {invitation?.invited_email}. This invite expires {invitation ? new Date(invitation.expires_at).toLocaleString() : ''}.</DialogDescription></DialogHeader>{qr ? <img alt="Self-service invitation QR code" className="mx-auto" src={qr} /> : <LoadingState label="Generating QR code…" />}</DialogContent></Dialog>
  </div>
}
