import { describe, expect, it } from 'vitest'
import { formatFollowers, normalizeCelebAccounts, parseCelebAccounts } from '../src/pages/commerce-studio/model/celebAccounts'
import { createCloudPatch } from '../src/pages/commerce-studio/api/commerceApi'
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
})
