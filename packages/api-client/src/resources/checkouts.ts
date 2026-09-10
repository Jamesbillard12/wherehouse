import { apiRequest } from '../client'
import type { Borrower, BorrowerInvitation, Checkout, CheckoutStatus, Device, InvitationClaimResult } from '../types'

export const listBorrowers = (token: string, workspaceId: string) => apiRequest<Borrower[]>(`/workspaces/${workspaceId}/borrowers`, { token })
export const createBorrower = (token: string, workspaceId: string, input: { display_name: string; email?: string | null }) => apiRequest<Borrower>(`/workspaces/${workspaceId}/borrowers`, { method: 'POST', token, body: input })
export const updateBorrower = (token: string, workspaceId: string, borrowerId: string, input: { display_name: string; email?: string | null }) => apiRequest<Borrower>(`/workspaces/${workspaceId}/borrowers/${borrowerId}`, { method: 'PATCH', token, body: input })
export const createBorrowerInvitation = (token: string, workspaceId: string, borrowerId: string) => apiRequest<BorrowerInvitation>(`/workspaces/${workspaceId}/borrowers/${borrowerId}/invitations`, { method: 'POST', token })
export const listBorrowerInvitations = (token: string, workspaceId: string) => apiRequest<BorrowerInvitation[]>(`/workspaces/${workspaceId}/borrower-invitations`, { token })
export const revokeBorrowerInvitation = (token: string, workspaceId: string, invitationId: string) => apiRequest<void>(`/workspaces/${workspaceId}/borrower-invitations/${invitationId}`, { method: 'DELETE', token })
export const inspectBorrowerInvitation = (inviteToken: string, baseUrl?: string) => apiRequest<BorrowerInvitation>(`/borrower-invitations/${encodeURIComponent(inviteToken)}`, { baseUrl })
export const claimBorrowerInvitation = (input: { token: string; password: string; display_name?: string; device_name: string; device_type: Device['device_type'] }, baseUrl?: string) => apiRequest<InvitationClaimResult>('/borrower-invitations/claim', { method: 'POST', body: input, baseUrl })
export const listCheckouts = (token: string, workspaceId: string, status: CheckoutStatus = 'active', baseUrl?: string) => apiRequest<Checkout[]>(`/workspaces/${workspaceId}/checkouts?status_filter=${status}`, { token, baseUrl })
export const checkoutItem = (token: string, workspaceId: string, input: { item_id: string; borrower_profile_id?: string; due_at?: string | null; notes?: string | null }, baseUrl?: string) => apiRequest<Checkout>(`/workspaces/${workspaceId}/checkouts`, { method: 'POST', token, body: input, baseUrl })
export const returnCheckout = (token: string, checkoutId: string, notes?: string | null, baseUrl?: string) => apiRequest<Checkout>(`/checkouts/${checkoutId}/return`, { method: 'POST', token, body: { notes }, baseUrl })
