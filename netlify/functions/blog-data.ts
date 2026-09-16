import { Buffer } from 'node:buffer'

const DEFAULT_OWNER = 'hwangsanghan0519'
const DEFAULT_REPO = 'blog'
const DEFAULT_BRANCH = 'main'
const DATA_PATH = 'data/blog-data.json'
const GITHUB_API = 'https://api.github.com'
const GITHUB_RAW = 'https://raw.githubusercontent.com'

type BlogData = {
  adBanners: unknown[]
  categories: string[]
  posts: unknown[]
  savedAt?: string
}

type GitHubContent = {
  content: string
  sha: string
}

type NetlifyEvent = {
  body: string | null
  headers: Record<string, string | undefined>
  httpMethod: string
}

const emptyData: BlogData = {
  adBanners: [],
  categories: [],
  posts: [],
}

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify(body),
})

export async function handler(event: NetlifyEvent) {
  try {
    if (event.httpMethod === 'GET') {
      const data = await readGitHubData()
      return json(200, data)
    }

    if (event.httpMethod !== 'PUT') {
      return json(405, { message: 'Method not allowed' })
    }

    const adminToken = process.env.BLOG_ADMIN_TOKEN
    const requestToken = event.headers['x-blog-admin-token']

    if (!adminToken || requestToken !== adminToken) {
      return json(401, { message: '관리자 저장 토큰이 필요합니다.' })
    }

    const payload = JSON.parse(event.body ?? '{}') as BlogData

    if (!Array.isArray(payload.posts) || !Array.isArray(payload.categories) || !Array.isArray(payload.adBanners)) {
      return json(400, { message: '저장 데이터 형식이 올바르지 않습니다.' })
    }

    const data: BlogData = {
      adBanners: payload.adBanners,
      categories: payload.categories,
      posts: payload.posts,
      savedAt: new Date().toISOString(),
    }

    await writeGitHubData(data)

    return json(200, data)
  } catch (error) {
    return json(500, { message: error instanceof Error ? error.message : '서버 저장소 오류가 발생했습니다.' })
  }
}

async function readGitHubData() {
  const token = process.env.GITHUB_CONTENT_TOKEN
  const response = token ? await githubFetch({ ref: true }) : await githubRawFetch()

  if (response.status === 404) return emptyData
  if (!response.ok) return emptyData

  const content = token
    ? Buffer.from(((await response.json()) as GitHubContent).content, 'base64').toString('utf8')
    : await response.text()

  return JSON.parse(content) as BlogData
}

async function writeGitHubData(data: BlogData) {
  const current = await githubFetch({ ref: true })
  const currentFile = current.ok ? ((await current.json()) as GitHubContent) : undefined
  const body = {
    branch: githubBranch(),
    content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf8').toString('base64'),
    message: `Update blog content ${new Date().toISOString()}`,
    sha: currentFile?.sha,
  }

  const response = await githubFetch({
    body: JSON.stringify(body),
    method: 'PUT',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GitHub content save failed: ${error}`)
  }
}

function githubFetch(init?: RequestInit & { ref?: boolean }) {
  const token = process.env.GITHUB_CONTENT_TOKEN

  if (!token) {
    throw new Error('GITHUB_CONTENT_TOKEN 환경변수가 필요합니다.')
  }

  const { ref, ...requestInit } = init ?? {}
  const url = `${GITHUB_API}/repos/${githubOwner()}/${githubRepo()}/contents/${DATA_PATH}${ref ? `?ref=${githubBranch()}` : ''}`

  return fetch(url, {
    ...requestInit,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      ...requestInit.headers,
    },
  })
}

function githubRawFetch() {
  return fetch(`${GITHUB_RAW}/${githubOwner()}/${githubRepo()}/${githubBranch()}/${DATA_PATH}`, {
    headers: {
      accept: 'application/json',
    },
  })
}

function githubOwner() {
  return process.env.GITHUB_OWNER || DEFAULT_OWNER
}

function githubRepo() {
  return process.env.GITHUB_REPO || DEFAULT_REPO
}

function githubBranch() {
  return process.env.GITHUB_BRANCH || DEFAULT_BRANCH
}
