import { abandonCheckoutSession, addCheckoutSessionItem, completeCheckoutSession, createBorrower, createBorrowerInvitation, getCurrentCheckoutSession, getItemImage, listBorrowerInvitations, listBorrowers, listCheckouts, listCheckoutSessions, removeCheckoutSessionItem, returnCheckout, revokeBorrowerInvitation, searchItems, subscribeToWorkspace, updateBorrower, updateCheckoutSession, type Borrower, type BorrowerInvitation, type Checkout, type CheckoutSession, type CheckoutStatus, type ItemSearchResult, type Workspace } from '@wherehouse/api-client'
import QRCode from 'qrcode'
import { Clock3, Plus, RotateCcw, Search, ShoppingCart, Trash2, UserRound, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/wherehouse/PageHeader'
import { EmptyState, ErrorState, LoadingState, StatusMessage } from '@/components/wherehouse/StateDisplay'
import { message } from '@/shared/utils/errors'

function SearchThumbnail({ imagePath, itemId, token }: { imagePath: string | null; itemId: string; token: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => { if (!imagePath) return; let active = true; let objectUrl = ''; void getItemImage(token, itemId).then((blob) => { if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) } }).catch(() => undefined); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) } }, [imagePath, itemId, token])
  return url ? <img alt="" className="size-10 rounded object-cover" src={url} /> : <span aria-hidden="true" className="size-10 rounded bg-muted" />
}

export function CheckoutsView({ isOwner, token, workspace }: { isOwner: boolean; token: string; workspace: Workspace }) {
  const [current, setCurrent] = useState<CheckoutSession | null>(null)
  const [sessions, setSessions] = useState<CheckoutSession[]>([])
  const [borrowers, setBorrowers] = useState<Borrower[]>([])
  const [invitations, setInvitations] = useState<BorrowerInvitation[]>([])
  const [checkouts, setCheckouts] = useState<Checkout[]>([])
  const [activeCheckouts, setActiveCheckouts] = useState<Checkout[]>([])
  const [tab, setTab] = useState<CheckoutStatus>('active')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [borrowerOpen, setBorrowerOpen] = useState(false)
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null)
  const [invitation, setInvitation] = useState<BorrowerInvitation | null>(null)
  const [inviteQr, setInviteQr] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ItemSearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let cancelled = false; setLoading(true)
    Promise.all([getCurrentCheckoutSession(token, workspace.id), listCheckoutSessions(token, workspace.id), isOwner ? listBorrowers(token, workspace.id) : Promise.resolve([]), listCheckouts(token, workspace.id, tab), listCheckouts(token, workspace.id, 'active'), isOwner ? listBorrowerInvitations(token, workspace.id) : Promise.resolve([])])
      .then(([own, active, profiles, history, availableState, activeInvites]) => { if (!cancelled) { setCurrent(own); setSessions(active); setBorrowers(profiles); setCheckouts(history); setActiveCheckouts(availableState); setInvitations(activeInvites); setError(null) } })
      .catch((reason) => !cancelled && setError(message(reason))).finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [isOwner, revision, tab, token, workspace.id])
  useEffect(() => subscribeToWorkspace({ workspaceId: workspace.id, token, onEvent: (event) => { if (event.type.startsWith('checkout_session.') || event.type === 'inventory.changed') setRevision((value) => value + 1) } }), [token, workspace.id])
  useEffect(() => { const value = query.trim(); if (!value) return setResults([]); const timer = window.setTimeout(() => void searchItems(token, workspace.id, value).then(setResults).catch(() => setResults([])), 200); return () => window.clearTimeout(timer) }, [query, token, workspace.id])
  useEffect(() => { if (!invitation?.invite_uri) return; void QRCode.toDataURL(invitation.invite_uri, { width: 280, margin: 1 }).then(setInviteQr) }, [invitation])

  async function configure(patch: Partial<{ borrower_profile_id: string | null; due_at: string | null; note: string | null }>) {
    if (!current) return
    setCurrent(await updateCheckoutSession(token, current.id, { borrower_profile_id: current.borrower_profile_id, due_at: current.due_at, note: current.note, expected_revision: current.revision, ...patch }))
  }
  async function addBorrower(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    const created = await createBorrower(token, workspace.id, { display_name: String(data.get('name')), email: String(data.get('email') || '') || null })
    setBorrowers((values) => [...values, created]); setBorrowerOpen(false); await configure({ borrower_profile_id: created.id })
  }
  async function completeCurrent() {
    if (!current) return
    try { setActionError(null); await completeCheckoutSession(token, current.id, current.revision); setRevision((v) => v + 1) }
    catch (reason) { setActionError(message(reason)); setRevision((v) => v + 1) }
  }
  async function editProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editingBorrower) return; const data = new FormData(event.currentTarget)
    await updateBorrower(token, workspace.id, editingBorrower.id, { display_name: String(data.get('name')), email: String(data.get('email') || '') || null })
    setEditingBorrower(null); setRevision((value) => value + 1)
  }
  const selected = new Set(current?.items.map((item) => item.item_id))
  const checkedOutIds = new Set(activeCheckouts.map((entry) => entry.item_id))
  const sessionActorsByItem = new Map<string, string[]>()
  for (const active of sessions) for (const item of active.items) if (active.id !== current?.id) sessionActorsByItem.set(item.item_id, [...(sessionActorsByItem.get(item.item_id) ?? []), active.actor_name])
  if (error) return <div className="feature-page"><PageHeader title="Checkouts" /><ErrorState title="Checkouts are unavailable" description={error} action={<Button onClick={() => setRevision((v) => v + 1)}>Try again</Button>} /></div>
  if (loading || !current) return <div className="feature-page"><PageHeader title="Checkouts" /><LoadingState label="Loading checkouts…" /></div>

  return <div className="feature-page"><PageHeader title="Checkouts" />
    <section className="rounded-xl border p-4"><div className="flex items-center justify-between"><div><h2>Your checkout</h2><p>{current.items.length} {current.items.length === 1 ? 'item' : 'items'} · synchronized across your devices</p></div><Button onClick={() => setPickerOpen(true)}><Search />Add items</Button></div>
      {actionError ? <StatusMessage tone="error">{actionError}. Your checkout was not changed; remove the unavailable item and try again.</StatusMessage> : null}
      {isOwner ? <div><label>Borrower<Select onValueChange={(value) => void configure({ borrower_profile_id: value })} value={current.borrower_profile_id ?? ''}><SelectTrigger><SelectValue placeholder="Select borrower" /></SelectTrigger><SelectContent>{borrowers.map((borrower) => <SelectItem key={borrower.id} value={borrower.id}>{borrower.display_name} · {borrower.access_type === 'managed' ? 'Managed' : 'Self-Service'}</SelectItem>)}</SelectContent></Select></label><Button onClick={() => setBorrowerOpen(true)} size="sm" variant="ghost"><Plus />Create borrower</Button></div> : <p>Borrower: {current.borrower_name}</p>}
      <div className="grid gap-3">{current.items.map((entry) => <article className="flex items-center justify-between rounded-lg border p-3" key={entry.id}><div><strong>{entry.item_name}</strong><small className="block">{entry.item_code}{entry.manufacturer ? ` · ${entry.manufacturer} ${entry.model ?? ''}` : ''}</small>{entry.availability === 'in_another_session' ? <StatusMessage tone="warning">Also in {entry.also_in_sessions.join(', ')}’s checkout</StatusMessage> : entry.availability === 'checked_out' ? <StatusMessage tone="error">Unavailable — already checked out</StatusMessage> : null}</div><Button aria-label={`Remove ${entry.item_name}`} onClick={() => void removeCheckoutSessionItem(token, current.id, entry.item_id).then(setCurrent)} size="icon" variant="ghost"><X /></Button></article>)}</div>
      <label>Due date (optional)<Input onChange={(event) => void configure({ due_at: event.target.value ? new Date(event.target.value).toISOString() : null })} type="date" value={current.due_at?.slice(0, 10) ?? ''} /></label><label>Note (optional)<Input defaultValue={current.note ?? ''} onBlur={(event) => void configure({ note: event.target.value || null })} /></label>
      <div className="flex gap-2"><Button disabled={!current.items.length || !current.borrower_profile_id || current.items.some((item) => item.availability === 'checked_out')} onClick={() => void completeCurrent()}><ShoppingCart />Check out {current.items.length || ''} {current.items.length === 1 ? 'item' : 'items'}</Button><Button disabled={!current.items.length} onClick={() => void abandonCheckoutSession(token, current.id).then(() => setRevision((v) => v + 1))} variant="outline"><Trash2 />Clear list</Button></div>
    </section>
    {isOwner ? <section><h2>Checkouts in progress</h2>{sessions.filter((entry) => entry.id !== current.id).length ? <div className="grid gap-3">{sessions.filter((entry) => entry.id !== current.id).map((entry) => <article className="rounded-xl border p-4" key={entry.id}><strong>{entry.actor_name}</strong><p>{entry.items.length} items{entry.borrower_name ? ` · for ${entry.borrower_name}` : ''}</p>{entry.items.map((item) => <small className="block" key={item.id}>{item.item_name}{item.availability !== 'available' ? ` · ${item.availability.replaceAll('_', ' ')}` : ''}</small>)}</article>)}</div> : <p>No other checkouts are being assembled.</p>}</section> : null}
    <div className="flex gap-2">{(['active', 'overdue', 'history'] as const).map((value) => <Button key={value} onClick={() => setTab(value)} variant={tab === value ? 'default' : 'outline'}>{value[0].toUpperCase() + value.slice(1)}</Button>)}</div>
    {checkouts.length ? <div className="grid gap-3">{checkouts.map((entry) => <article className="rounded-xl border p-4" key={entry.id}><div className="flex justify-between"><div><h3>{entry.item_name}</h3><p>{entry.borrower_name}</p><small>{entry.due_at ? `Due ${new Date(entry.due_at).toLocaleDateString()}` : 'No due date'}</small></div>{!entry.returned_at ? <Button onClick={() => void returnCheckout(token, entry.id).then(() => setRevision((v) => v + 1))} variant="outline"><RotateCcw />Return</Button> : null}</div></article>)}</div> : <EmptyState icon={Clock3} title={`No ${tab} checkouts`} />}
    {isOwner ? <section><h2>Borrowers</h2><div className="grid gap-3">{borrowers.map((borrower) => { const activeInvite = invitations.find((value) => value.borrower_profile_id === borrower.id); return <article className="rounded-xl border p-4" key={borrower.id}><UserRound /><strong>{borrower.display_name}</strong><p>{borrower.access_type === 'managed' ? 'Managed Borrower' : 'Self-Service Borrower'}{borrower.email ? ` · ${borrower.email}` : ''}</p><Button onClick={() => setEditingBorrower(borrower)} variant="outline">Edit</Button>{activeInvite ? <><StatusMessage>Invite expires {new Date(activeInvite.expires_at).toLocaleString()}</StatusMessage><Button onClick={() => void revokeBorrowerInvitation(token, workspace.id, activeInvite.id).then(() => setRevision((v) => v + 1))} variant="outline">Revoke invite</Button><Button onClick={() => void createBorrowerInvitation(token, workspace.id, borrower.id).then((value) => { setInvitation(value); setRevision((v) => v + 1) })} variant="outline">Reissue invite</Button></> : borrower.access_type === 'managed' && borrower.email ? <Button onClick={() => void createBorrowerInvitation(token, workspace.id, borrower.id).then(setInvitation)} variant="outline">Enable self-service</Button> : null}</article> })}</div></section> : null}
    <Dialog onOpenChange={setPickerOpen} open={pickerOpen}><DialogContent><DialogHeader><DialogTitle>Add items to checkout</DialogTitle><DialogDescription>Search by name, code, manufacturer, model, or location. Add multiple items without closing this dialog.</DialogDescription></DialogHeader><Input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Search thousands of items…" type="search" value={query} /><div className="max-h-80 overflow-auto">{results.map((result) => { const otherActors = sessionActorsByItem.get(result.item.id) ?? []; const unavailable = checkedOutIds.has(result.item.id); return <button className="flex w-full items-center justify-between border-b p-3 text-left" disabled={selected.has(result.item.id) || unavailable} key={result.item.id} onClick={() => void addCheckoutSessionItem(token, current.id, result.item.id).then(setCurrent)} type="button"><SearchThumbnail imagePath={result.item.image_path} itemId={result.item.id} token={token} /><span className="grow px-3"><strong>{result.item.name}</strong><small className="block">{result.item.code} · {result.resolved_path ?? 'Unplaced'}{result.item.manufacturer ? ` · ${result.item.manufacturer} ${result.item.model ?? ''}` : ''}</small><small className="block">{unavailable ? 'Checked out · unavailable' : otherActors.length ? `Available · also in ${isOwner ? otherActors.join(', ') : 'another person'}’s checkout` : 'Available'}</small></span><span>{selected.has(result.item.id) ? 'Added' : unavailable ? 'Unavailable' : 'Add'}</span></button> })}</div><DialogFooter><Button onClick={() => setPickerOpen(false)}>Review checkout</Button></DialogFooter></DialogContent></Dialog>
    <Dialog onOpenChange={setBorrowerOpen} open={borrowerOpen}><DialogContent><form onSubmit={(event) => void addBorrower(event)}><DialogHeader><DialogTitle>Create Managed Borrower</DialogTitle><DialogDescription>Email is optional and can be added later for self-service access.</DialogDescription></DialogHeader><label>Name<Input name="name" required /></label><label>Email (optional)<Input name="email" type="email" /></label><DialogFooter><Button type="submit">Create and select</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog onOpenChange={(open) => !open && setEditingBorrower(null)} open={Boolean(editingBorrower)}><DialogContent><form onSubmit={(event) => void editProfile(event)}><DialogHeader><DialogTitle>Edit Borrower</DialogTitle><DialogDescription>Revoke an active invitation before changing its email. Linked account email changes require a separate identity flow.</DialogDescription></DialogHeader><label>Name<Input defaultValue={editingBorrower?.display_name} name="name" required /></label><label>Email (optional)<Input defaultValue={editingBorrower?.email ?? ''} name="email" type="email" /></label><DialogFooter><Button type="submit">Save changes</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog onOpenChange={(open) => { if (!open) { setInvitation(null); setInviteQr('') } }} open={Boolean(invitation)}><DialogContent><DialogHeader><DialogTitle>Self-service invitation</DialogTitle><DialogDescription>{invitation?.borrower_name} must authenticate as {invitation?.invited_email}. The code expires {invitation ? new Date(invitation.expires_at).toLocaleString() : ''}.</DialogDescription></DialogHeader>{inviteQr ? <img alt="Self-service invitation QR code" className="mx-auto" src={inviteQr} /> : <LoadingState label="Generating invitation…" />}</DialogContent></Dialog>
  </div>
}
