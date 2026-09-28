import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readSavedProfiles, retainProfile, saveProfileLocally } from '../src/pages/commerce-studio/model/celebProfileCache'
import type { CelebStoryFeed } from '../src/pages/commerce-studio/model/celebStoryTypes'

const profile: CelebStoryFeed = {
  accounts: [], account: { name: '수영', username: 'sooyoungchoi' }, followers: 7377654,
  profileImage: 'https://example.com/profile.jpg', fetchedAt: '2026-09-28T00:00:00Z', state: 'ready',
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('last confirmed follower count', () => {
  it('survives repeated network and API failures beyond the old one-hour limit', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-28T00:00:00Z'))
    let displayed: CelebStoryFeed | undefined = profile
    const failures: Array<CelebStoryFeed | undefined> = [
      undefined,
      { ...profile, state: 'unavailable', followers: null, profileImage: '', fetchedAt: null },
      { ...profile, state: 'unconfigured', followers: null, profileImage: '', fetchedAt: null },
      { ...profile, state: 'ready', followers: null },
    ]
    for (const failure of failures) {
      vi.advanceTimersByTime(2 * 60 * 60_000)
      displayed = retainProfile(displayed, failure)
      expect(displayed).toEqual({ ...profile, state: 'stale' })
    }
    expect(profile.state).toBe('ready')
  })

  it('accepts recovery, including decreasing counts and a valid zero', () => {
    const stale = retainProfile(profile, undefined)
    const recovered = { ...profile, followers: 7377600, fetchedAt: '2026-09-28T08:00:00Z' }
    expect(retainProfile(stale, recovered)).toEqual(recovered)
    expect(retainProfile(recovered, { ...recovered, followers: 0 })).toMatchObject({ followers: 0, state: 'ready' })
    expect(retainProfile({ ...profile, followers: 0 }, undefined)).toMatchObject({ followers: 0, state: 'stale' })
  })

  it('preserves the last count while reflecting the latest failure reason', () => {
    expect(retainProfile(profile, { ...profile, followers: null, state: 'unavailable', issue: 'authentication' }))
      .toMatchObject({ followers: profile.followers, state: 'stale', issue: 'authentication' })
  })

  it('never replaces confirmed data with malformed counts', () => {
    for (const followers of [null, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, '123' as unknown as number]) {
      const invalid = { ...profile, followers }
      expect(retainProfile(profile, invalid)).toEqual({ ...profile, state: 'stale' })
      expect(retainProfile(undefined, invalid)).toMatchObject({ followers: null, state: 'unavailable' })
    }
  })

  it('does not copy a count to another Instagram username', () => {
    const other: CelebStoryFeed = { ...profile, account: { name: '예지', username: 'yezyizhere' }, followers: null, state: 'unavailable' }
    expect(retainProfile(profile, other)).toEqual(other)
  })

  it('can display server fallback data without allowing it to overwrite an already confirmed count', () => {
    const serverFallback: CelebStoryFeed = { ...profile, followers: 7377600, state: 'stale' }
    expect(retainProfile(undefined, serverFallback)).toEqual(serverFallback)
    expect(retainProfile(serverFallback, undefined)).toEqual(serverFallback)
    expect(retainProfile(profile, serverFallback)).toEqual({ ...profile, state: 'stale' })
  })

  it('accepts a newer server snapshot over an older browser snapshot', () => {
    const newer: CelebStoryFeed = { ...profile, followers: 7377500, fetchedAt: '2026-09-28T09:00:00Z', state: 'stale' }
    expect(retainProfile({ ...profile, state: 'stale' }, newer)).toEqual(newer)
  })

  it('does not invent a value before the first successful response or after reload', () => {
    expect(retainProfile(undefined, undefined)).toBeUndefined()
    const failure: CelebStoryFeed = { ...profile, state: 'unavailable', followers: null }
    expect(retainProfile(undefined, failure)).toEqual(failure)
    expect(retainProfile(failure, undefined)).toBeUndefined()
    // A fresh page starts with no React profile state, even after a prior page succeeded.
    retainProfile(undefined, profile)
    expect(retainProfile(undefined, failure)?.followers).toBeNull()
  })

  it('does not discard an otherwise valid count because of a missing timestamp', () => {
    expect(retainProfile({ ...profile, fetchedAt: null }, undefined)).toMatchObject({ followers: profile.followers, state: 'stale' })
  })
})

describe('browser snapshot persistence', () => {
  const values = new Map<string, string>()
  beforeEach(() => {
    values.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-29T00:00:00Z'))
  })

  it('restores a saved count after reload and a long authentication outage', () => {
    saveProfileLocally(profile)
    vi.setSystemTime(new Date('2027-09-29T00:00:00Z'))
    expect(readSavedProfiles([profile.account])[profile.account.username]).toMatchObject({ followers: profile.followers, fetchedAt: profile.fetchedAt, state: 'stale' })
    saveProfileLocally({ ...profile, state: 'unavailable', followers: null, issue: 'authentication' })
    expect(readSavedProfiles([profile.account])[profile.account.username]?.followers).toBe(profile.followers)
    expect(readSavedProfiles([{ name: '다른 계정', username: 'someone_else' }])).toEqual({})
  })

  it('keeps the newer snapshot while accepting a real decrease or zero', () => {
    const newer = { ...profile, followers: 0, fetchedAt: '2026-09-28T20:00:00Z' }
    saveProfileLocally(newer)
    saveProfileLocally(profile)
    expect(readSavedProfiles([profile.account])[profile.account.username]?.followers).toBe(0)
  })

  it('tolerates corrupt data, blocked storage and invalid timestamps', () => {
    saveProfileLocally({ ...profile, fetchedAt: '2027-01-01T00:00:00Z' })
    expect(values.size).toBe(0)
    saveProfileLocally(profile)
    const key = [...values.keys()][0]
    values.set(key, '{broken')
    expect(readSavedProfiles([profile.account])).toEqual({})
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('quota') } })
    expect(() => saveProfileLocally(profile)).not.toThrow()
    expect(readSavedProfiles([profile.account])).toEqual({})
  })
})
