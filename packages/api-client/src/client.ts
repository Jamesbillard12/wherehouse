import { API_VERSION } from './types'

export type ApiOptions = Omit<RequestInit, 'body'> & {
  baseUrl?: string
  body?: unknown
  token?: string
}

const REQUEST_TIMEOUT_MS = 15_000

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { baseUrl, body, headers, signal, token, ...requestOptions } = options
  const apiBase = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/${API_VERSION}` : `/api/${API_VERSION}`
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...requestOptions,
      signal: controller.signal,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { detail?: string } | null
      throw new Error(payload?.detail ?? `WhereHouse request failed (${response.status}).`)
    }
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
  } catch (reason) {
    if (controller.signal.aborted && !signal?.aborted) throw new Error('WhereHouse request timed out.')
    throw reason
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
