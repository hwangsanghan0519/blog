import { normalizeCelebAccounts } from '../../pages/commerce-studio/model/celebAccounts.ts'
import type { CelebAccount } from '../../pages/commerce-studio/model/celebStoryTypes.ts'
import { SEO_HOME_DESCRIPTION, seoTitle } from './seo-config.ts'

export { normalizeCelebAccounts }

export function getCelebSeo(category: string, accounts: CelebAccount[]) {
  const account = accounts.find((item) => item.name === category)
  return {
    account,
    title: seoTitle(account ? `${category} 인스타그램 @${account.username} · 착용·광고 상품` : `${category} 착용·광고 상품, 인스타·유튜브 핫템`),
    description: account
      ? `${category} 인스타그램 @${account.username} 프로필 바로가기와 팔로워 현황, 착용·소개·광고 상품을 함께 확인하세요. 파워퍼프셀럽에서 ${category}의 패션·뷰티 핫템과 제휴몰 가격을 살펴보세요.`
      : `${category}가 유튜브와 인스타그램에서 착용·소개·광고한 상품을 모았습니다. 화제의 핫템과 잇템, 등록된 제휴몰 최저가를 파워퍼프셀럽에서 확인하세요.`,
  }
}

export function getCelebHomeDescription(accounts: CelebAccount[]) {
  return accounts.length ? `${SEO_HOME_DESCRIPTION} ${accounts.slice(0, 5).map((account) => account.name).join('·')} 인스타그램 프로필과 팔로워 현황도 확인하세요.` : SEO_HOME_DESCRIPTION
}

export function createCelebPerson(account: CelebAccount, origin: string) {
  const url = `${origin}/celeb/${encodeURIComponent(account.name)}`
  return { '@type': 'Person', '@id': `${url}#person`, name: account.name, alternateName: `@${account.username}`, url, sameAs: [`https://www.instagram.com/${account.username}/`] }
}

export function createCelebList(accounts: CelebAccount[], origin: string) {
  return {
    '@type': 'ItemList', '@id': `${origin}/#instagram-live`, name: '인스타라이브 셀럽 인스타그램',
    numberOfItems: accounts.length,
    itemListElement: accounts.map((account, index) => ({ '@type': 'ListItem', position: index + 1, item: createCelebPerson(account, origin) })),
  }
}
