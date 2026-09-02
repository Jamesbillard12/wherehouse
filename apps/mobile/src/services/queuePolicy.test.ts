import { describe, expect, it } from 'vitest'

import { classifyQueueFailure, isSupportedItemCreate, nextRetryAt } from './queuePolicy'

describe('offline queue policy', () => {
  it('retries transient failures and pauses for authentication', () => {
    expect(classifyQueueFailure()).toEqual({ pause: false, retry: true })
    expect(classifyQueueFailure(503)).toEqual({ pause: false, retry: true })
    expect(classifyQueueFailure(401)).toEqual({ pause: true, retry: true })
  })

  it('does not retry permanent request failures', () => {
    expect(classifyQueueFailure(409)).toEqual({ pause: false, retry: false })
    expect(classifyQueueFailure(422)).toEqual({ pause: false, retry: false })
  })

  it('bounds exponential retry delay', () => {
    expect(nextRetryAt(1, 0)).toBe('1970-01-01T00:00:02.000Z')
    expect(nextRetryAt(20, 0)).toBe('1970-01-01T00:05:00.000Z')
  })

  it('accepts only the documented operation envelope', () => {
    expect(isSupportedItemCreate('item.create', 1, 1)).toBe(true)
    expect(isSupportedItemCreate('item.update', 1, 1)).toBe(false)
    expect(isSupportedItemCreate('item.create', 2, 1)).toBe(false)
  })
})
