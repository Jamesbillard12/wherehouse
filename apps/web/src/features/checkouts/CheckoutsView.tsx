import { abandonCheckoutSession, addCheckoutSessionItem, completeCheckoutSession, createBorrower, createBorrowerInvitation, getCurrentCheckoutSession, getItemImage, listBorrowerInvitations, listBorrowers, listCheckouts, listCheckoutSessions, removeCheckoutSessionItem, returnCheckout, revokeBorrowerInvitation, searchItems, subscribeToWorkspace, updateBorrower, updateCheckoutSession, type Borrower, type BorrowerInvitation, type Checkout, type CheckoutSession, type CheckoutStatus, type ItemSearchResult, type Workspace } from '@wherehouse/api-client'
import QRCode from 'qrcode'
import { CalendarDays, Check, Clock3, PackageOpen, Plus, RotateCcw, Search, ShoppingCart, Trash2, UserRound, UsersRound, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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

  const otherSessions = sessions.filter((entry) => entry.id !== current.id)
  return <div className="feature-page space-y-8"><PageHeader actions={<Button onClick={() => setPickerOpen(true)}><Plus />Add items</Button>} description="Build a list, assign a borrower, then check everything out at once." title="Checkouts" />
    {actionError ? <StatusMessage tone="error">{actionError}. Your checkout was not changed; remove the unavailable item and try again.</StatusMessage> : null}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-5"><div><div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShoppingCart className="size-5" /></span><h2 className="text-lg font-semibold">Your checkout</h2></div><p className="mt-2 text-sm text-muted-foreground">{current.items.length ? `${current.items.length} ${current.items.length === 1 ? 'item' : 'items'} ready to review` : 'Items you add here sync across your devices.'}</p></div><span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">{current.items.length}</span></div>
        {current.items.length ? <div className="divide-y">{current.items.map((entry) => <article className="flex items-start gap-4 px-6 py-4" key={entry.id}><span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><PackageOpen className="size-5" /></span><div className="min-w-0 grow"><strong className="block truncate text-sm">{entry.item_name}</strong><p className="mt-0.5 text-xs text-muted-foreground">{entry.item_code}{entry.manufacturer ? ` · ${entry.manufacturer} ${entry.model ?? ''}` : ''}</p>{entry.availability === 'in_another_session' ? <StatusMessage className="mt-2" tone="warning">Also in {entry.also_in_sessions.join(', ')}’s checkout</StatusMessage> : entry.availability === 'checked_out' ? <StatusMessage className="mt-2" tone="error">Unavailable — already checked out</StatusMessage> : <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><Check className="size-3.5" />Available</p>}</div><Button aria-label={`Remove ${entry.item_name}`} onClick={() => void removeCheckoutSessionItem(token, current.id, entry.item_id).then(setCurrent)} size="icon" variant="ghost"><X /></Button></article>)}</div> : <div className="flex flex-col items-center px-6 py-14 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><PackageOpen className="size-6" /></span><h3 className="mt-4 font-semibold">Your checkout is empty</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">Search your inventory or scan items with the companion app.</p><Button className="mt-5" onClick={() => setPickerOpen(true)} variant="outline"><Search />Find items</Button></div>}
      </section>
      <aside className="space-y-4">
        <section className="rounded-2xl border bg-card p-5 shadow-sm"><h2 className="font-semibold">Checkout details</h2><p className="mt-1 text-sm text-muted-foreground">These details apply to every item in the list.</p><div className="mt-5 space-y-4">
          {isOwner ? <div><label className="mb-1.5 block text-sm font-medium">Borrower</label><Select items={borrowers.map((borrower) => ({ label: `${borrower.display_name} · ${borrower.access_type === 'managed' ? 'Managed' : 'Self-service'}`, value: borrower.id }))} onValueChange={(value) => void configure({ borrower_profile_id: value })} value={current.borrower_profile_id ?? ''}><SelectTrigger aria-label="Borrower" className="w-full"><SelectValue placeholder="Choose a borrower" /></SelectTrigger><SelectContent>{borrowers.map((borrower) => <SelectItem key={borrower.id} value={borrower.id}>{borrower.display_name} · {borrower.access_type === 'managed' ? 'Managed' : 'Self-service'}</SelectItem>)}</SelectContent></Select><Button className="mt-1 px-0" onClick={() => setBorrowerOpen(true)} size="sm" variant="ghost"><Plus />Create borrower</Button></div> : <div><p className="text-sm font-medium">Borrower</p><p className="mt-1 text-sm text-muted-foreground">{current.borrower_name}</p></div>}
          <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><CalendarDays className="size-4 text-muted-foreground" />Due date <span className="font-normal text-muted-foreground">(optional)</span></span><Input onChange={(event) => void configure({ due_at: event.target.value ? new Date(event.target.value).toISOString() : null })} type="date" value={current.due_at?.slice(0, 10) ?? ''} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Note <span className="font-normal text-muted-foreground">(optional)</span></span><Textarea className="min-h-20 resize-none" defaultValue={current.note ?? ''} onBlur={(event) => void configure({ note: event.target.value || null })} placeholder="Add pickup details or a reminder…" /></label>
        </div><div className="mt-5 grid gap-2"><Button className="w-full" disabled={!current.items.length || !current.borrower_profile_id || current.items.some((item) => item.availability === 'checked_out')} onClick={() => void completeCurrent()}><ShoppingCart />Check out {current.items.length ? `${current.items.length} ${current.items.length === 1 ? 'item' : 'items'}` : 'items'}</Button><Button className="w-full" disabled={!current.items.length} onClick={() => void abandonCheckoutSession(token, current.id).then(() => setRevision((v) => v + 1))} variant="ghost"><Trash2 />Clear checkout</Button></div></section>
        {isOwner ? <section className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><UsersRound className="size-4 text-muted-foreground" /><h2 className="font-semibold">In progress</h2><span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{otherSessions.length}</span></div>{otherSessions.length ? <div className="mt-4 space-y-3">{otherSessions.map((entry) => <article className="rounded-xl bg-muted/60 p-3" key={entry.id}><strong className="text-sm">{entry.actor_name}</strong><p className="mt-0.5 text-xs text-muted-foreground">{entry.items.length} {entry.items.length === 1 ? 'item' : 'items'}{entry.borrower_name ? ` · for ${entry.borrower_name}` : ''}</p></article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No one else is assembling a checkout.</p>}</section> : null}
      </aside>
    </div>
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5"><div><h2 className="font-semibold">Loan activity</h2><p className="mt-1 text-sm text-muted-foreground">Track what is out, overdue, or already returned.</p></div><div className="flex rounded-lg bg-muted p-1">{(['active', 'overdue', 'history'] as const).map((value) => <Button className="h-8 capitalize shadow-none" key={value} onClick={() => setTab(value)} size="sm" variant={tab === value ? 'default' : 'ghost'}>{value}</Button>)}</div></div>
      {checkouts.length ? <div className="divide-y">{checkouts.map((entry) => <article className="flex items-center justify-between gap-4 px-6 py-4" key={entry.id}><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{entry.item_name}</h3><p className="mt-1 text-xs text-muted-foreground">{entry.borrower_name} · {entry.due_at ? `Due ${new Date(entry.due_at).toLocaleDateString()}` : 'No due date'}</p></div>{!entry.returned_at ? <Button onClick={() => void returnCheckout(token, entry.id).then(() => setRevision((v) => v + 1))} size="sm" variant="outline"><RotateCcw />Return</Button> : null}</article>)}</div> : <EmptyState className="min-h-0 border-0 py-12" description={tab === 'active' ? 'Completed checkouts will appear here.' : undefined} icon={Clock3} title={`No ${tab} checkouts`} />}
    </section>
    {isOwner ? <section><div className="mb-4 flex items-end justify-between"><div><h2 className="text-lg font-semibold">Borrowers</h2><p className="mt-1 text-sm text-muted-foreground">Manage the people who can borrow items.</p></div><Button onClick={() => setBorrowerOpen(true)} variant="outline"><Plus />New borrower</Button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{borrowers.map((borrower) => { const activeInvite = invitations.find((value) => value.borrower_profile_id === borrower.id); return <article className="rounded-2xl border bg-card p-5" key={borrower.id}><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-5" /></span><div className="min-w-0 grow"><strong className="block truncate text-sm">{borrower.display_name}</strong><p className="mt-0.5 truncate text-xs text-muted-foreground">{borrower.access_type === 'managed' ? 'Managed borrower' : 'Self-service borrower'}{borrower.email ? ` · ${borrower.email}` : ''}</p></div><Button onClick={() => setEditingBorrower(borrower)} size="sm" variant="ghost">Edit</Button></div>{activeInvite ? <div className="mt-4 space-y-2"><StatusMessage>Invite expires {new Date(activeInvite.expires_at).toLocaleString()}</StatusMessage><div className="flex gap-2"><Button onClick={() => void revokeBorrowerInvitation(token, workspace.id, activeInvite.id).then(() => setRevision((v) => v + 1))} size="sm" variant="outline">Revoke</Button><Button onClick={() => void createBorrowerInvitation(token, workspace.id, borrower.id).then((value) => { setInvitation(value); setRevision((v) => v + 1) })} size="sm" variant="outline">Reissue</Button></div></div> : borrower.access_type === 'managed' && borrower.email ? <Button className="mt-4" onClick={() => void createBorrowerInvitation(token, workspace.id, borrower.id).then(setInvitation)} size="sm" variant="outline">Enable self-service</Button> : null}</article> })}</div></section> : null}
    <Dialog onOpenChange={setPickerOpen} open={pickerOpen}><DialogContent><DialogHeader><DialogTitle>Add items to checkout</DialogTitle><DialogDescription>Search by name, code, manufacturer, model, or location. Add multiple items without closing this dialog.</DialogDescription></DialogHeader><Input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Search thousands of items…" type="search" value={query} /><div className="max-h-80 overflow-auto">{results.map((result) => { const otherActors = sessionActorsByItem.get(result.item.id) ?? []; const unavailable = checkedOutIds.has(result.item.id); return <button className="flex w-full items-center justify-between border-b p-3 text-left" disabled={selected.has(result.item.id) || unavailable} key={result.item.id} onClick={() => void addCheckoutSessionItem(token, current.id, result.item.id).then(setCurrent)} type="button"><SearchThumbnail imagePath={result.item.image_path} itemId={result.item.id} token={token} /><span className="grow px-3"><strong>{result.item.name}</strong><small className="block">{result.item.code} · {result.resolved_path ?? 'Unplaced'}{result.item.manufacturer ? ` · ${result.item.manufacturer} ${result.item.model ?? ''}` : ''}</small><small className="block">{unavailable ? 'Checked out · unavailable' : otherActors.length ? `Available · also in ${isOwner ? otherActors.join(', ') : 'another person'}’s checkout` : 'Available'}</small></span><span>{selected.has(result.item.id) ? 'Added' : unavailable ? 'Unavailable' : 'Add'}</span></button> })}</div><DialogFooter><Button onClick={() => setPickerOpen(false)}>Review checkout</Button></DialogFooter></DialogContent></Dialog>
    <Dialog onOpenChange={setBorrowerOpen} open={borrowerOpen}><DialogContent><form onSubmit={(event) => void addBorrower(event)}><DialogHeader><DialogTitle>Create Managed Borrower</DialogTitle><DialogDescription>Email is optional and can be added later for self-service access.</DialogDescription></DialogHeader><label>Name<Input name="name" required /></label><label>Email (optional)<Input name="email" type="email" /></label><DialogFooter><Button type="submit">Create and select</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog onOpenChange={(open) => !open && setEditingBorrower(null)} open={Boolean(editingBorrower)}><DialogContent><form onSubmit={(event) => void editProfile(event)}><DialogHeader><DialogTitle>Edit Borrower</DialogTitle><DialogDescription>Revoke an active invitation before changing its email. Linked account email changes require a separate identity flow.</DialogDescription></DialogHeader><label>Name<Input defaultValue={editingBorrower?.display_name} name="name" required /></label><label>Email (optional)<Input defaultValue={editingBorrower?.email ?? ''} name="email" type="email" /></label><DialogFooter><Button type="submit">Save changes</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog onOpenChange={(open) => { if (!open) { setInvitation(null); setInviteQr('') } }} open={Boolean(invitation)}><DialogContent><DialogHeader><DialogTitle>Self-service invitation</DialogTitle><DialogDescription>{invitation?.borrower_name} must authenticate as {invitation?.invited_email}. The code expires {invitation ? new Date(invitation.expires_at).toLocaleString() : ''}.</DialogDescription></DialogHeader>{inviteQr ? <img alt="Self-service invitation QR code" className="mx-auto" src={inviteQr} /> : <LoadingState label="Generating invitation…" />}</DialogContent></Dialog>
  </div>
}
