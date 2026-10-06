import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/app/lib/prisma"

interface IncomingRepo {
  fullName: string
  stars?: number
  language?: string | null
  description?: string | null
}

interface IncomingIssue {
  githubIssueId?: string
  number?: number
  title?: string
  url?: string
  bodyPreview?: string | null
  state?: string
  authorAssociation?: string
  commentsCount?: number
  isAssigned?: boolean
  hasLinkedPr?: boolean
  createdAt?: string
}

interface SaveRequest {
  issueId: string
  issue?: IncomingIssue
  repo?: IncomingRepo
}

const MAX_ID_LENGTH = 100
const MAX_TITLE_LENGTH = 500
const MAX_REPOSITORY_LENGTH = 201
const MAX_URL_LENGTH = 2048
const MAX_BODY_PREVIEW_LENGTH = 700
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_LANGUAGE_LENGTH = 100
const MAX_USERNAME_LENGTH = 100

const GITHUB_REPOSITORY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/

async function getAuthenticatedUserId(): Promise<string> {
  const session = await auth()

  if (!session?.user?.githubId) {
    throw new Error("NOT_AUTHENTICATED")
  }

  const user = await prisma.user.findUnique({
    where: {
      githubId: session.user.githubId,
    },
    select: {
      id: true,
    },
  })

  if (!user) {
    throw new Error("USER_NOT_FOUND")
  }

  return user.id
}

function authErrorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown error"

  if (message === "NOT_AUTHENTICATED") {
    return NextResponse.json(
      { error: "NOT_AUTHENTICATED" },
      { status: 401 }
    )
  }

  if (message === "USER_NOT_FOUND") {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    )
  }

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  )
}

function isSaveRequest(body: unknown): body is SaveRequest {
  if (!body || typeof body !== "object") {
    return false
  }

  const value = body as Record<string, unknown>

  return (
    typeof value.issueId === "string" &&
    value.issueId.trim().length > 0 &&
    value.issueId.length <= MAX_ID_LENGTH
  )
}

async function upsertIssueFromPayload(
  fallbackGithubIssueId: string,
  issue: IncomingIssue,
  repo: IncomingRepo | undefined
): Promise<{ id: string } | null> {
  if (!repo?.fullName || !issue.url || !issue.title) {
    return null
  }

  if (
    !GITHUB_REPOSITORY_PATTERN.test(repo.fullName) ||
    repo.fullName.length > MAX_REPOSITORY_LENGTH
  ) {
    return null
  }

  if (
    issue.githubIssueId != null &&
    (issue.githubIssueId.trim().length === 0 ||
      issue.githubIssueId.length > MAX_ID_LENGTH)
  ) {
    return null
  }

  if (
    issue.title.length === 0 ||
    issue.title.length > MAX_TITLE_LENGTH
  ) {
    return null
  }

  if (issue.url.length > MAX_URL_LENGTH) {
    return null
  }

  if (
    issue.bodyPreview != null &&
    issue.bodyPreview.length > MAX_BODY_PREVIEW_LENGTH
  ) {
    return null
  }

  if (
    repo.description != null &&
    repo.description.length > MAX_DESCRIPTION_LENGTH
  ) {
    return null
  }

  if (
    repo.language != null &&
    repo.language.length > MAX_LANGUAGE_LENGTH
  ) {
    return null
  }

  if (
    repo.fullName.split("/")[0].length >
    MAX_USERNAME_LENGTH
  ) {
    return null
  }

  const githubIssueId =
    issue.githubIssueId ?? fallbackGithubIssueId

  const githubRepoId = `fullname:${repo.fullName}`
  const ownerLogin =
    repo.fullName.split("/")[0] ?? "unknown"

  const dbRepo = await prisma.repo.upsert({
    where: {
      githubRepoId,
    },

    update: {
      fullName: repo.fullName,
      stars: repo.stars ?? 0,
      language: repo.language ?? null,
      description: repo.description ?? null,
      ownerLogin,
      lastSyncedAt: new Date(),
    },

    create: {
      githubRepoId,
      fullName: repo.fullName,
      ownerLogin,
      stars: repo.stars ?? 0,
      language: repo.language ?? null,
      description: repo.description ?? null,
      lastSyncedAt: new Date(),
    },
  })

  return prisma.issue.upsert({
    where: {
      githubIssueId,
    },

    update: {
      repoId: dbRepo.id,
      number: issue.number ?? 0,
      title: issue.title,
      url: issue.url,
      bodyPreview: issue.bodyPreview ?? null,
      state: issue.state ?? "OPEN",
      authorAssociation:
        issue.authorAssociation ?? "NONE",
      commentsCount: issue.commentsCount ?? 0,
      isAssigned: issue.isAssigned ?? false,
      hasLinkedPr: issue.hasLinkedPr ?? false,
      ...(issue.createdAt
        ? (() => {
            const parsedDate = new Date(
              issue.createdAt
            )

            return Number.isNaN(parsedDate.getTime())
              ? {}
              : { createdAt: parsedDate }
          })()
        : {}),
      lastSyncedAt: new Date(),
    },

    create: {
      githubIssueId,
      repoId: dbRepo.id,
      number: issue.number ?? 0,
      title: issue.title,
      url: issue.url,
      bodyPreview: issue.bodyPreview ?? null,
      state: issue.state ?? "OPEN",
      authorAssociation:
        issue.authorAssociation ?? "NONE",
      commentsCount: issue.commentsCount ?? 0,
      isAssigned: issue.isAssigned ?? false,
      hasLinkedPr: issue.hasLinkedPr ?? false,
      createdAt: (() => {
        if (!issue.createdAt) {
          return new Date()
        }

        const parsedDate = new Date(
          issue.createdAt
        )

        return Number.isNaN(parsedDate.getTime())
          ? new Date()
          : parsedDate
      })(),
      lastSyncedAt: new Date(),
    },

    select: {
      id: true,
    },
  })
}

export async function GET() {
  let userId: string

  try {
    userId = await getAuthenticatedUserId()
  } catch (error) {
    return authErrorResponse(error)
  }

  try {
    const saved = await prisma.savedIssue.findMany({
      where: {
        userId,
      },
      select: {
        issue: {
          select: {
            id: true,
            githubIssueId: true,
          },
        },
      },
    })

    return NextResponse.json({ saved })
  } catch {
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  let userId: string

  try {
    userId = await getAuthenticatedUserId()
  } catch (error) {
    return authErrorResponse(error)
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

  if (!isSaveRequest(body)) {
    return NextResponse.json(
      { error: "issueId is required" },
      { status: 400 }
    )
  }

  const issueId = body.issueId.trim()

  let issueRow: { id: string } | null = null

  try {
    issueRow = await prisma.issue.findUnique({
      where: {
        id: issueId,
      },
      select: {
        id: true,
      },
    })

    if (!issueRow && body.issue && body.repo) {
      issueRow = await upsertIssueFromPayload(
        issueId,
        body.issue,
        body.repo
      )
    }
  } catch {
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    )
  }

  if (!issueRow) {
    return NextResponse.json(
      {
        error:
          "Issue not found (no payload to create it from)",
      },
      { status: 404 }
    )
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.savedIssue.findFirst({
          where: {
            userId,
            issueId: issueRow.id,
          },
          select: {
            id: true,
          },
        })

        if (existing) {
          await tx.savedIssue.delete({
            where: {
              id: existing.id,
            },
          })

          return { saved: false }
        }

        await tx.savedIssue.create({
          data: {
            userId,
            issueId: issueRow.id,
            savedAt: new Date(),
          },
        })

        return { saved: true }
      }
    )

    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    )
  }
}