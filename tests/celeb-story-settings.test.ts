import { describe, expect, it } from 'vitest'
import { formatFollowers, normalizeCelebAccounts, parseCelebAccounts } from '../src/pages/commerce-studio/model/celebAccounts'
import { retainProfile } from '../src/pages/commerce-studio/model/celebProfileCache'
import { createCloudPatch } from '../src/pages/commerce-studio/api/commerceApi'
import type { CelebStoryFeed } from '../src/pages/commerce-studio/model/celebStoryTypes'
import type { CloudCommerceSnapshot } from '../src/pages/commerce-studio/model/types'

describe('story registration and presentation', () => {
  it('normalizes profile URLs and handles without accepting invalid names', () => {
    expect(parseCelebAccounts([{ name: ' 수영 ', username: 'https://www.instagram.com/SOOYOUNGCHOI/?hl=ko' }])).toEqual([{ name: '수영', username: 'sooyoungchoi' }])
    expect(() => parseCelebAccounts([{ name: 'x', username: '@same' }, { name: 'y', username: 'same' }])).toThrow()
    expect(() => parseCelebAccounts([{ name: '', username: 'valid' }])).toThrow()
    expect(normalizeCelebAccounts([])).toEqual([])
    expect(normalizeCelebAccounts(undefined).length).toBeGreaterThan(0)
  })
  it('uses compact Korean units while preserving zero and marking unknown values', () => {
    expect(formatFollowers(7377757)).toBe('737.8만')
    expect(formatFollowers(1250)).toBe('1,250')
    expect(formatFollowers(999)).toBe('999')
    expect(formatFollowers(999999)).toBe('100만')
    expect(formatFollowers(10000)).toBe('1만')
    expect(formatFollowers(99995000)).toBe('1억')
    expect(formatFollowers(125000000)).toBe('1.3억')
    expect(formatFollowers(0)).toBe('0')
    expect(formatFollowers(null)).toBe('???')
    expect(formatFollowers(NaN)).toBe('???')
  })
  it('includes story edits in cloud patches without touching products', () => {
    const previous = { posts: [], celebAccounts: [{ name: '수영', username: 'sooyoungchoi' }] } as unknown as CloudCommerceSnapshot
    expect(createCloudPatch(previous, { ...previous, celebAccounts: [] })).toEqual({ celebAccounts: [] })
  })
  it('keeps recent successful numbers during outages but expires old ones', () => {
    const now = Date.parse('2026-09-26T06:00:00Z')
    const profile: CelebStoryFeed = { accounts: [], account: { name: '수영', username: 'sooyoungchoi' }, followers: 100, profileImage: '', fetchedAt: new Date(now - 60000).toISOString(), state: 'ready' }
    expect(retainProfile(profile, undefined, now)).toMatchObject({ followers: 100, state: 'stale' })
    expect(retainProfile(profile, undefined, now + 3600000)).toBeUndefined()
    expect(retainProfile(profile, { ...profile, state: 'ready', followers: 101 }, now)?.followers).toBe(101)
    expect(retainProfile(profile, { ...profile, account: { name: '다른 계정', username: 'other' }, state: 'unavailable', followers: null }, now)?.followers).toBeNull()
  })
})
