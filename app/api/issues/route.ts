import { NextRequest, NextResponse } from "next/server"

import { getAccessToken } from "@/app/lib/getAccessToken"
import {
  chunkRepoScope,
  fetchRepoMetadata,
  searchIssues,
  searchRepositories,
  type RepoMetadata,
  type SearchIssueResult,
  type SearchIssuesPage,
} from "@/app/lib/github"
import { prisma } from "@/app/lib/prisma"

const MAX_RESULTS = 150
const MAX_PER_REPO = 2
const MAX_REPO_ISSUES = 100
const REPOS_PER_BAND = 20
const MAX_ISSUE_QUERIES = 20
const ISSUES_PER_QUERY = 50
const MIN_STARS = 1000
const MAX_STARS = 50000

const STAR_EDGES = [
  MIN_STARS,
  3000,
  7000,
  15000,
  30000,
  MAX_STARS,
]

const STAR_BANDS = STAR_EDGES
  .slice(0, -1)
  .map((min, index) => ({
    min,
    max: STAR_EDGES[index + 1],
  }))

function bandIndex(stars: number) {
  return STAR_BANDS.findIndex(
    (band) =>
      stars >= band.min &&
      stars < band.max
  )
}

function cleanInput(input: string) {
  return input
    .trim()
    .replace(
      /^https?:\/\/github\.com\//i,
      ""
    )
    .replace(/^github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/g, "")
    .replace(/^Search\s+/i, "")
    .trim()
}

function isExactRepository(input: string) {
  const parts = input.split("/")

  return (
    input.includes("/") &&
    parts.length === 2 &&
    parts.every(Boolean)
  )
}

function makeRepoKey(fullName: string) {
  return fullName.toLowerCase()
}

function makeBodyPreview(body: string | null) {
  return body ? body.slice(0, 700) : null
}

function toApiIssue(
  issue: SearchIssueResult,
  repoMeta: {
    fullName: string
    stars: number
    language: string | null
    description: string | null
  }
) {
  return {
    id: issue.id,
    githubIssueId: issue.id,
    number: issue.number,
    title: issue.title,
    url: issue.url,
    bodyPreview: makeBodyPreview(issue.body),
    state: issue.state,
    authorAssociation:
      issue.authorAssociation,
    commentsCount: issue.commentsCount,
    isAssigned: issue.isAssigned,
    hasLinkedPr: issue.hasLinkedPr,
    createdAt: issue.createdAt,
    aiScore: null,
    repo: repoMeta,
  }
}

function isAuthError(message: string) {
  const normalized = message.toLowerCase()

  return (
    normalized.includes("401") ||
    normalized.includes("403") ||
    normalized.includes("unauthorized") ||
    normalized.includes("bad credentials")
  )
}

async function cacheIssues(
  issues: SearchIssueResult[],
  repoMetaByFullName: Map<
    string,
    RepoMetadata
  >,
  syncTimestamp: Date
) {
  const CHUNK_SIZE = 10

  for (
    let i = 0;
    i < issues.length;
    i += CHUNK_SIZE
  ) {
    const chunk = issues.slice(
      i,
      i + CHUNK_SIZE
    )

    await Promise.allSettled(
      chunk.map(async (issue) => {
        const [owner] =
          issue.repository.nameWithOwner.split(
            "/"
          )

        const meta =
          repoMetaByFullName.get(
            issue.repository.nameWithOwner
          )

        await prisma.repo.upsert({
          where: {
            githubRepoId:
              issue.repository.id,
          },

          update: {
            fullName:
              issue.repository.nameWithOwner,
            description:
              issue.repository.description,
            stars: issue.repository.stars,
            language:
              issue.repository.language,
            ownerLogin: owner,
            lastSyncedAt:
              syncTimestamp,
          },

          create: {
            githubRepoId:
              issue.repository.id,
            fullName:
              issue.repository.nameWithOwner,
            description:
              issue.repository.description,
            stars: issue.repository.stars,
            language:
              issue.repository.language,
            ownerLogin: owner,
            lastSyncedAt:
              syncTimestamp,
          },
        })

        const repo =
          await prisma.repo.findUnique({
            where: {
              githubRepoId:
                issue.repository.id,
            },
            select: {
              id: true,
            },
          })

        if (!repo) {
          throw new Error(
            "Cached repository could not be resolved"
          )
        }

        await prisma.issue.upsert({
          where: {
            githubIssueId: issue.id,
          },

          update: {
            repoId: repo.id,
            title: issue.title,
            number: issue.number,
            url: issue.url,
            bodyPreview:
              makeBodyPreview(issue.body),
            state: issue.state,
            authorAssociation:
              issue.authorAssociation,
            commentsCount:
              issue.commentsCount,
            isAssigned:
              issue.isAssigned,
            hasLinkedPr:
              issue.hasLinkedPr,
            lastSyncedAt:
              syncTimestamp,
          },

          create: {
            githubIssueId: issue.id,
            repoId: repo.id,
            title: issue.title,
            number: issue.number,
            url: issue.url,
            bodyPreview:
              makeBodyPreview(issue.body),
            state: issue.state,
            authorAssociation:
              issue.authorAssociation,
            commentsCount:
              issue.commentsCount,
            isAssigned:
              issue.isAssigned,
            hasLinkedPr:
              issue.hasLinkedPr,
            createdAt:
              new Date(issue.createdAt),
            lastSyncedAt:
              syncTimestamp,
          },
        })

        void meta
      })
    )
  }
}

export async function POST(
  req: NextRequest
) {
  let accessToken: string

  try {
    accessToken = await getAccessToken()
  } catch {
    return NextResponse.json(
      { error: "NOT_AUTHENTICATED" },
      { status: 401 }
    )
  }

  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }

  const rawRepo = (
    body as Record<string, unknown>
  ).repo

  const rawInput =
    typeof rawRepo === "string"
      ? rawRepo.trim()
      : ""

  if (!rawInput) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 }
    )
  }

  const input = cleanInput(rawInput)

  if (!input) {
    return NextResponse.json(
      { error: "Search query is empty" },
      { status: 400 }
    )
  }

  if (isExactRepository(input)) {
    const [owner, repoName] =
      input.split("/")

    let repo: RepoMetadata

    try {
      repo = await fetchRepoMetadata(
        owner,
        repoName,
        accessToken
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : ""

      if (isAuthError(message)) {
        return NextResponse.json(
          { error: "TOKEN_REVOKED" },
          { status: 401 }
        )
      }

      if (
        message.toLowerCase().includes(
          "not found"
        ) ||
        message.includes("404")
      ) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 }
        )
      }

      return NextResponse.json(
        {
          error:
            message ||
            "Failed to fetch repository",
        },
        { status: 500 }
      )
    }

    if (
      repo.stars < MIN_STARS ||
      repo.stars >= MAX_STARS
    ) {
      return NextResponse.json({
        mode: "repository",
        search: {
          input: rawInput,
          resolved:
            repo.nameWithOwner,
        },
        repos: [],
        issues: [],
        pagination: {
          hasNextPage: false,
          endCursor: null,
        },
      })
    }

    const results: SearchIssueResult[] = []
    const seenIssueIds =
      new Set<string>()

    let cursor: string | undefined
    let hasNextPage = true

    try {
      for (
        let page = 0;
        page < 2 &&
        hasNextPage &&
        results.length <
          MAX_REPO_ISSUES;
        page++
      ) {
        const githubResult =
          await searchIssues(
            `repo:${owner}/${repoName}`,
            accessToken,
            cursor
          )

        for (const issue of
          githubResult.issues) {
          if (
            seenIssueIds.has(issue.id)
          ) {
            continue
          }

          const stars =
            issue.repository.stars

          if (
            stars < MIN_STARS ||
            stars >= MAX_STARS
          ) {
            continue
          }

          seenIssueIds.add(issue.id)
          results.push(issue)

          if (
            results.length >=
            MAX_REPO_ISSUES
          ) {
            break
          }
        }

        hasNextPage =
          githubResult.hasNextPage

        cursor =
          githubResult.endCursor ??
          undefined
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : ""

      if (isAuthError(message)) {
        return NextResponse.json(
          { error: "TOKEN_REVOKED" },
          { status: 401 }
        )
      }

      return NextResponse.json(
        {
          error:
            message ||
            "GitHub issue search failed",
        },
        { status: 500 }
      )
    }

    const repoMeta = {
      fullName: repo.nameWithOwner,
      stars: repo.stars,
      language: repo.language,
      description: repo.description,
    }

    const syncTimestamp =
      new Date()

    const repoMetaByFullName =
      new Map<string, RepoMetadata>()

    repoMetaByFullName.set(
      repo.nameWithOwner,
      repo
    )

    void cacheIssues(
      results,
      repoMetaByFullName,
      syncTimestamp
    )

    return NextResponse.json({
      mode: "repository",
      search: {
        input: rawInput,
        resolved:
          repo.nameWithOwner,
      },
      repos: [repoMeta],
      issues: results.map(
        (issue) =>
          toApiIssue(
            issue,
            repoMeta
          )
      ),
      pagination: {
        hasNextPage:
          hasNextPage &&
          results.length >=
            MAX_REPO_ISSUES,
        endCursor:
          cursor ?? null,
      },
    })
  }

  const bandSearches =
    await Promise.allSettled(
      STAR_BANDS.map((band) =>
        searchRepositories(
          input,
          accessToken,
          {
            minStars: band.min,
            maxStars: band.max,
            perPage:
              REPOS_PER_BAND,
          }
        )
      )
    )

  const reposByBand: string[][] = []
  let repoSearchError: unknown =
    null

  for (const outcome of
    bandSearches) {
    if (
      outcome.status ===
      "fulfilled"
    ) {
      reposByBand.push(
        outcome.value.map(
          (repo) =>
            repo.full_name
        )
      )
    } else {
      reposByBand.push([])

      if (!repoSearchError) {
        repoSearchError =
          outcome.reason
      }
    }
  }

  const totalRepos =
    reposByBand.reduce(
      (sum, names) =>
        sum + names.length,
      0
    )

  if (!totalRepos) {
    if (repoSearchError) {
      const message =
        repoSearchError instanceof
          Error
          ? repoSearchError.message
          : ""

      if (isAuthError(message)) {
        return NextResponse.json(
          { error: "TOKEN_REVOKED" },
          { status: 401 }
        )
      }

      return NextResponse.json(
        {
          error:
            message ||
            "GitHub repository search failed",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      mode: "global",
      search: {
        input: rawInput,
        resolved: null,
      },
      repos: [],
      issues: [],
      pagination: {
        hasNextPage: false,
        endCursor: null,
      },
    })
  }

  const chunksByBand =
    reposByBand.map((names) =>
      chunkRepoScope(names)
    )

  const interleavedChunks: string[][] =
    []

  for (let i = 0; ; i++) {
    let added = false

    for (
      const chunks of chunksByBand
    ) {
      if (i < chunks.length) {
        interleavedChunks.push(
          chunks[i]
        )
        added = true
      }
    }

    if (!added) {
      break
    }
  }

  const scopeChunks =
    interleavedChunks.slice(
      0,
      MAX_ISSUE_QUERIES
    )

  const settled =
    await Promise.allSettled(
      scopeChunks.map(
        (repoScope) =>
          searchIssues(
            input,
            accessToken,
            undefined,
            {
              repoScope,
              pageSize:
                ISSUES_PER_QUERY,
            }
          )
      )
    )

  const fetchedPages: SearchIssuesPage[] =
    []

  let firstError: unknown = null

  for (const outcome of
    settled) {
    if (
      outcome.status ===
      "fulfilled"
    ) {
      fetchedPages.push(
        outcome.value
      )
    } else if (!firstError) {
      firstError =
        outcome.reason
    }
  }

  if (
    !fetchedPages.length &&
    firstError
  ) {
    const message =
      firstError instanceof Error
        ? firstError.message
        : ""

    if (isAuthError(message)) {
      return NextResponse.json(
        { error: "TOKEN_REVOKED" },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        error:
          message ||
          "GitHub issue search failed",
      },
      { status: 500 }
    )
  }

  const allIssues =
    fetchedPages
      .flatMap(
        (page) => page.issues
      )
      .sort((a, b) =>
        b.createdAt.localeCompare(
          a.createdAt
        )
      )

  const buckets:
    SearchIssueResult[][] =
    STAR_BANDS.map(() => [])

  const seenIssueIds =
    new Set<string>()

  const perRepoCount =
    new Map<string, number>()

  for (const issue of
    allIssues) {
    if (
      seenIssueIds.has(issue.id)
    ) {
      continue
    }

    const band = bandIndex(
      issue.repository.stars
    )

    if (band === -1) {
      continue
    }

    const repoKey =
      makeRepoKey(
        issue.repository
          .nameWithOwner
      )

    const count =
      perRepoCount.get(
        repoKey
      ) ?? 0

    if (
      count >= MAX_PER_REPO
    ) {
      continue
    }

    perRepoCount.set(
      repoKey,
      count + 1
    )

    seenIssueIds.add(issue.id)
    buckets[band].push(issue)
  }

  const results:
    SearchIssueResult[] = []

  for (
    let i = 0;
    results.length <
      MAX_RESULTS;
    i++
  ) {
    let added = false

    for (
      const bucket of buckets
    ) {
      if (
        i < bucket.length &&
        results.length <
          MAX_RESULTS
      ) {
        results.push(
          bucket[i]
        )
        added = true
      }
    }

    if (!added) {
      break
    }
  }

  if (!results.length) {
    return NextResponse.json({
      mode: "global",
      search: {
        input: rawInput,
        resolved: null,
      },
      repos: [],
      issues: [],
      pagination: {
        hasNextPage: false,
        endCursor: null,
      },
    })
  }

  const repoMap = new Map<
    string,
    {
      owner: string
      name: string
      fullName: string
    }
  >()

  for (const issue of
    results) {
    const fullName =
      issue.repository
        .nameWithOwner

    const key =
      makeRepoKey(fullName)

    if (repoMap.has(key)) {
      continue
    }

    const [
      owner,
      name,
    ] = fullName.split("/")

    repoMap.set(key, {
      owner,
      name,
      fullName,
    })
  }

  const syncTimestamp =
    new Date()

  const repoMetaByFullName =
    new Map<string, RepoMetadata>()

  for (const issue of
    results) {
    const fullName =
      issue.repository
        .nameWithOwner

    if (
      repoMetaByFullName.has(
        fullName
      )
    ) {
      continue
    }

    repoMetaByFullName.set(
      fullName,
      {
        id: issue.repository.id,
        nameWithOwner: fullName,
        description:
          issue.repository
            .description,
        stars:
          issue.repository.stars,
        language:
          issue.repository
            .language,
      }
    )
  }

  void cacheIssues(
    results,
    repoMetaByFullName,
    syncTimestamp
  )

  const finalIssues =
    results.map((issue) =>
      toApiIssue(issue, {
        fullName:
          issue.repository
            .nameWithOwner,
        stars:
          issue.repository.stars,
        language:
          issue.repository
            .language,
        description:
          issue.repository
            .description,
      })
    )

  const repoSummary =
    [...repoMap.values()].map(
      (repo) => {
        const matchingIssue =
          results.find(
            (issue) =>
              issue.repository
                .nameWithOwner
                .toLowerCase() ===
              repo.fullName
                .toLowerCase()
          )

        return {
          fullName:
            repo.fullName,
          stars:
            matchingIssue
              ?.repository.stars ??
            0,
          language:
            matchingIssue
              ?.repository
              .language ?? null,
          description:
            matchingIssue
              ?.repository
              .description ??
            null,
        }
      }
    )

  return NextResponse.json({
    mode: "global",
    search: {
      input: rawInput,
      resolved: null,
    },
    repos: repoSummary,
    issues: finalIssues,
    pagination: {
      hasNextPage: false,
      endCursor: null,
    },
  })
}