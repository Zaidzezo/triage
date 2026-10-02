const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql"
const GITHUB_REST_URL = "https://api.github.com"

export interface SearchRepository {
  id: string
  name: string
  full_name: string
  description: string | null
  stargazers_count: number
  language: string | null
  owner: {
    login: string
  }
}

export interface RepoMetadata {
  id: string
  nameWithOwner: string
  description: string | null
  stars: number
  language: string | null
}

export interface SearchIssueResult {
  id: string
  number: number
  title: string
  body: string | null
  state: string
  url: string
  createdAt: string
  authorAssociation: string
  commentsCount: number
  isAssigned: boolean
  hasLinkedPr: boolean

  repository: {
    id: string
    nameWithOwner: string
    description: string | null
    stars: number
    language: string | null
    ownerLogin: string
  }
}

export interface SearchIssuesPage {
  issues: SearchIssueResult[]
  hasNextPage: boolean
  endCursor: string | null
  totalCount: number
}

interface GitHubIssueNode {
  id?: string
  number?: number
  title?: string
  body?: string | null
  state?: string
  url?: string
  createdAt?: string
  authorAssociation?: string

  comments?: {
    totalCount?: number
  }

  repository?: {
    id?: string
    nameWithOwner?: string
    description?: string | null
    stargazerCount?: number
    primaryLanguage?: {
      name?: string | null
    } | null
  } | null
}

interface GitHubSearchResponse {
  data?: {
    search?: {
      nodes?: GitHubIssueNode[]
      issueCount?: number
      pageInfo?: {
        hasNextPage?: boolean
        endCursor?: string | null
      }
    }
  }

  errors?: Array<{
    message?: string
  }>
}

function restHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
}

export async function searchRepositories(
  query: string,
  accessToken: string,
  opts?: {
    minStars?: number
    maxStars?: number
    perPage?: number
  }
): Promise<SearchRepository[]> {
  const minStars = opts?.minStars ?? 1000
  const perPage = opts?.perPage ?? 10

  const starRange =
    opts?.maxStars != null
      ? `stars:${minStars}..${opts.maxStars - 1}`
      : `stars:>=${minStars}`

  const q =
    `${query} in:name,description,readme ` +
    `${starRange} archived:false fork:false`

  const url =
    `${GITHUB_REST_URL}/search/repositories?` +
    new URLSearchParams({
      q,
      per_page: String(perPage),
      sort: "stars",
      order: "desc",
    })

  const response = await fetch(url, {
    headers: restHeaders(accessToken),
  })

  if (!response.ok) {
    const errorText = await response.text()

    throw new Error(
      `GitHub repository search error ${response.status}: ${errorText}`
    )
  }

  const data: unknown = await response.json()

  if (!data || typeof data !== "object") {
    return []
  }

  const items = (data as Record<string, unknown>).items

  return Array.isArray(items)
    ? (items as SearchRepository[])
    : []
}

export async function fetchRepoMetadata(
  owner: string,
  repo: string,
  accessToken: string
): Promise<RepoMetadata> {
  const url = `${GITHUB_REST_URL}/repos/${owner}/${repo}`

  const response = await fetch(url, {
    headers: restHeaders(accessToken),
  })

  if (response.status === 404) {
    throw new Error("Repository not found")
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const data = (await response.json()) as {
    id?: number
    full_name?: string
    description?: string | null
    stargazers_count?: number
    language?: string | null
  }

  if (!data.full_name) {
    throw new Error("GitHub returned invalid repository data")
  }

  return {
    id: String(data.id ?? ""),
    nameWithOwner: data.full_name,
    description: data.description ?? null,
    stars: data.stargazers_count ?? 0,
    language: data.language ?? null,
  }
}

export const SCOPE_CHAR_BUDGET = 170

export function chunkRepoScope(
  names: string[],
  maxChars: number = SCOPE_CHAR_BUDGET
): string[][] {
  const chunks: string[][] = []
  let current: string[] = []
  let length = 0

  for (const name of names) {
    const partLength = `repo:${name}`.length + 1

    if (
      current.length > 0 &&
      length + partLength > maxChars
    ) {
      chunks.push(current)
      current = []
      length = 0
    }

    current.push(name)
    length += partLength
  }

  if (current.length > 0) {
    chunks.push(current)
  }

  return chunks
}

export interface SearchIssuesOptions {
  minStars?: number
  unassignedOnly?: boolean
  maxAgeMonths?: number
  repoScope?: string[]
  pageSize?: number
}

export async function searchIssues(
  queryText: string,
  accessToken: string,
  cursor?: string,
  opts?: SearchIssuesOptions
): Promise<SearchIssuesPage> {
  const query = `
    query SearchIssues(
      $query: String!
      $cursor: String
      $first: Int!
    ) {
      search(
        query: $query
        type: ISSUE
        first: $first
        after: $cursor
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        issueCount

        nodes {
          ... on Issue {
            id
            number
            title
            body
            state
            url
            createdAt
            authorAssociation

            comments {
              totalCount
            }

            repository {
              id
              nameWithOwner
              description
              stargazerCount

              primaryLanguage {
                name
              }
            }
          }
        }
      }
    }
  `

  const minStars = opts?.minStars ?? 1000
  const unassignedOnly =
    opts?.unassignedOnly ?? true
  const maxAgeMonths = opts?.maxAgeMonths ?? 6
  const pageSize = Math.min(
    Math.max(opts?.pageSize ?? 100, 1),
    100
  )

  const cutoffDate = new Date()
  cutoffDate.setMonth(
    cutoffDate.getMonth() - maxAgeMonths
  )

  const dateStr = cutoffDate
    .toISOString()
    .split("T")[0]

  const scopeParts: string[] = []
  let scopeLength = 0

  for (const name of opts?.repoScope ?? []) {
    const part = `repo:${name}`

    if (
      scopeParts.length > 0 &&
      scopeLength + part.length + 1 >
        SCOPE_CHAR_BUDGET
    ) {
      break
    }

    scopeParts.push(part)
    scopeLength += part.length + 1
  }

  const isScoped = scopeParts.length > 0

  const githubSearchQuery = isScoped
    ? `is:issue is:open ${
        unassignedOnly ? "no:assignee " : ""
      }${scopeParts.join(
        " "
      )} created:>${dateStr} sort:created-desc`
    : `${queryText.trim()} ` +
      `is:issue is:open ${
        unassignedOnly ? "no:assignee " : ""
      }` +
      `stars:>${minStars} ` +
      `created:>${dateStr} sort:created-desc`

  const response = await fetch(
    GITHUB_GRAPHQL_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          query: githubSearchQuery,
          cursor: cursor ?? null,
          first: pageSize,
        },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(
      `GitHub search error: ${response.status}`
    )
  }

  const data =
    (await response.json()) as GitHubSearchResponse

  if (data.errors?.length) {
    throw new Error(
      data.errors[0]?.message ??
        "GitHub issue search failed"
    )
  }

  const searchData = data.data?.search
  const nodes = searchData?.nodes ?? []

  const issues: SearchIssueResult[] = []

  for (const issue of nodes) {
    const repository = issue.repository

    if (
      !repository?.id ||
      !repository.nameWithOwner ||
      !issue.id ||
      issue.number == null ||
      !issue.title ||
      !issue.url ||
      !issue.createdAt ||
      !issue.state ||
      !issue.authorAssociation
    ) {
      continue
    }

    issues.push({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body ?? null,
      state: issue.state,
      url: issue.url,
      createdAt: issue.createdAt,
      authorAssociation:
        issue.authorAssociation,
      commentsCount:
        issue.comments?.totalCount ?? 0,
      isAssigned: false,
      hasLinkedPr: false,

      repository: {
        id: repository.id,
        nameWithOwner:
          repository.nameWithOwner,
        description:
          repository.description ?? null,
        stars:
          repository.stargazerCount ?? 0,
        language:
          repository.primaryLanguage?.name ??
          null,
        ownerLogin:
          repository.nameWithOwner.split(
            "/"
          )[0] ?? "",
      },
    })
  }

  return {
    issues,
    hasNextPage:
      searchData?.pageInfo?.hasNextPage ??
      false,
    endCursor:
      searchData?.pageInfo?.endCursor ??
      null,
    totalCount:
      searchData?.issueCount ?? 0,
  }
}