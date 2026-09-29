import { describe, expect, it } from 'vitest'
import { parseDesktopCollection, shuffleDesktopCards } from './desktopCollection'

describe('desktop collection compatibility', () => {
  it('reads the existing mobile array and safely handles invalid storage', () => {
    expect(parseDesktopCollection('["a","b","a",null,4]')).toEqual(['a', 'b'])
    for (const value of [null, '', '{', '{}', 'null']) expect(parseDesktopCollection(value)).toEqual([])
    expect(parseDesktopCollection(JSON.stringify(Array.from({ length: 2001 }, (_, i) => String(i))))).toHaveLength(2000)
  })
  it('shuffles without losing cards, mutating the collection or keeping the same order', () => {
    const ids = ['a', 'b', 'c', 'd']
    for (const random of [() => 0, () => .999, () => .5]) {
      const next = shuffleDesktopCards(ids, random)
      expect([...next].sort()).toEqual(ids)
      expect(next).not.toEqual(ids)
      expect(ids).toEqual(['a', 'b', 'c', 'd'])
    }
    expect(shuffleDesktopCards([])).toEqual([])
    expect(shuffleDesktopCards(['a'])).toEqual(['a'])
  })
})
