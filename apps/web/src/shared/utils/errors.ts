import { ApiError } from '@wherehouse/api-client'

export function message(reason: unknown): string {
  if (reason instanceof ApiError) {
    if (reason.status === 401) return 'Your session expired. Sign in again.'
    if (reason.status === 403) return 'You do not have access to this household.'
    if (reason.status === 400 && /pairing token/i.test(reason.message)) {
      return 'This pairing code is invalid or expired. Create a new code and try again.'
    }
  }
  return reason instanceof Error ? reason.message : 'Something went wrong.'
}
