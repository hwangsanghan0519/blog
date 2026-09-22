import { describe, expect, it } from 'vitest'
import type { Post } from '../../../entities/post/model/types'
import { searchProductTitles } from './productSearch'

const posts = [
  { id: 'blouse', title: '한소희 오피스 출근룩 블라우스', category: '한소희', status: 'published' },
  { id: 'bag', title: 'LOEUVRE Mini Bag SW4XB354-03', category: '한소희', status: 'published' },
  { id: 'draft', title: '한소희 블라우스 비공개', status: 'draft' },
] as Post[]

describe('mobile product title search', () => {
  it('matches multiple words in any order using only published titles', () => {
    expect(searchProductTitles(posts, '블라우스 한소희').map((post) => post.id)).toEqual(['blouse'])
    expect(searchProductTitles(posts, '한소희').map((post) => post.id)).toEqual(['blouse'])
    expect(searchProductTitles(posts, '블라우스 가방')).toEqual([])
  })
  it('handles case, spacing, full-width input and literal punctuation safely', () => {
    expect(searchProductTitles(posts, '  mini  bag  ').map((post) => post.id)).toEqual(['bag'])
    expect(searchProductTitles(posts, '출근 룩').map((post) => post.id)).toEqual(['blouse'])
    expect(searchProductTitles(posts, 'ＭＩＮＩ').map((post) => post.id)).toEqual(['bag'])
    expect(searchProductTitles(posts, '[')).toEqual([])
    expect(searchProductTitles(posts, '   ')).toEqual([])
    expect(searchProductTitles(posts, 'sw4xb354-03').map((post) => post.id)).toEqual(['bag'])
  })
})
