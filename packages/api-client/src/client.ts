import { API_VERSION } from './types'

export type ApiOptions = Omit<RequestInit, 'body'> & {
  baseUrl?: string
  body?: unknown
  token?: string
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { baseUrl, body, headers, token, ...requestOptions } = options
  const apiBase = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/${API_VERSION}` : `/api/${API_VERSION}`
  const response = await fetch(`${apiBase}${path}`, {
    ...requestOptions,
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
}
