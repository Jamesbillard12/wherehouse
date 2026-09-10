import * as SecureStore from 'expo-secure-store'
import { consumePairing } from '@wherehouse/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isJoinUri, isPairingUri, pairDevice, parseJoinUri, parsePairingUri } from './pairing'

vi.mock('expo-secure-store', () => ({ setItemAsync: vi.fn() }))
vi.mock('@wherehouse/api-client', () => ({ consumePairing: vi.fn() }))

const validUri = 'wherehouse://pair?type=wherehouse-pairing&version=1&server=http%3A%2F%2Fwherehouse.local&token=pair_secret'

describe('pairing QR payloads', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses the versioned WhereHouse payload', () => {
    expect(parsePairingUri(validUri)).toEqual({
      server: 'http://wherehouse.local',
      token: 'pair_secret',
    })
    expect(isPairingUri(validUri)).toBe(true)
  })

  it('parses a self-service invitation without account credentials in the link', () => {
    const value = 'wherehouse://join?server=https%3A%2F%2Fhome.example&invite=invite_secret'
    expect(parseJoinUri(value)).toEqual({ server: 'https://home.example', token: 'invite_secret' })
    expect(isJoinUri(value)).toBe(true)
    expect(value).not.toContain('password')
  })

  it.each([
    ['foreign QR code', 'https://example.com'],
    ['legacy unversioned payload', 'wherehouse://pair?server=https%3A%2F%2Fexample.com&token=pair_secret'],
    ['unsupported version', 'wherehouse://pair?type=wherehouse-pairing&version=2&server=https%3A%2F%2Fexample.com&token=pair_secret'],
    ['missing token', 'wherehouse://pair?type=wherehouse-pairing&version=1&server=https%3A%2F%2Fexample.com'],
  ])('rejects a %s', (_description, value) => {
    expect(() => parsePairingUri(value)).toThrow()
    expect(isPairingUri(value)).toBe(false)
  })

  it.each(['localhost', '127.0.0.1', '[::1]'])('rejects an unreachable loopback server (%s)', (host) => {
    const value = `wherehouse://pair?type=wherehouse-pairing&version=1&server=${encodeURIComponent(`http://${host}:8000`)}&token=pair_secret`
    expect(() => parsePairingUri(value)).toThrow(/PUBLIC_BASE_URL/)
  })

  it('redeems the token and securely persists the returned device credential', async () => {
    vi.mocked(consumePairing).mockResolvedValue({
      access_token: 'dev_secret',
      token_type: 'bearer',
      expires_at: null,
      base_url: 'http://wherehouse.local',
      device_id: 'device-1',
      workspace_id: 'workspace-1',
      instance_id: 'instance-1',
      instance_name: 'Home WhereHouse',
      user_id: 'user-1',
    })

    const paired = await pairDevice(validUri, 'ios companion')

    expect(consumePairing).toHaveBeenCalledOnce()
    expect(consumePairing).toHaveBeenCalledWith('http://wherehouse.local', {
      token: 'pair_secret', device_name: 'ios companion', device_type: 'phone',
    })
    expect(paired.deviceId).toBe('device-1')
    expect(SecureStore.setItemAsync).toHaveBeenCalledOnce()
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'wherehouse.pairing.v1', expect.stringContaining('dev_secret'),
    )
  })
})
