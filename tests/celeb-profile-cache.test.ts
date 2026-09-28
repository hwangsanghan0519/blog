import { afterEach, describe, expect, it, vi } from 'vitest'
import { retainProfile } from '../src/pages/commerce-studio/model/celebProfileCache'
import type { CelebStoryFeed } from '../src/pages/commerce-studio/model/celebStoryTypes'

const profile: CelebStoryFeed = {
  accounts: [], account: { name: '수영', username: 'sooyoungchoi' }, followers: 7377654,
  profileImage: 'https://example.com/profile.jpg', fetchedAt: '2026-09-28T00:00:00Z', state: 'ready',
}
afterEach(() => vi.useRealTimers())

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
