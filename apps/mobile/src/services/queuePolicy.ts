export type QueueFailure = { pause: boolean; retry: boolean }

export function classifyQueueFailure(status?: number): QueueFailure {
  if (status === undefined) return { pause: false, retry: true }
  if (status === 401 || status === 403) return { pause: true, retry: true }
  if ([408, 425, 429].includes(status) || status >= 500) return { pause: false, retry: true }
  return { pause: false, retry: false }
}

export function nextRetryAt(attempt: number, now = Date.now()): string {
  const delaySeconds = Math.min(300, 2 ** Math.min(attempt, 10))
  return new Date(now + delaySeconds * 1000).toISOString()
}

export function isSupportedItemCreate(type: string, version: number, draftVersion: number): boolean {
  return type === 'item.create' && version === 1 && draftVersion === 1
}
