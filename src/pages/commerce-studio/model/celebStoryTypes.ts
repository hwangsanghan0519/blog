export type CelebAccount = { name: string; username: string }

export type CelebStoryFeed = {
  accounts: CelebAccount[]
  account: CelebAccount
  profileImage: string
  followers: number | null
  fetchedAt: string | null
  state: 'ready' | 'stale' | 'unconfigured' | 'unavailable'
}
