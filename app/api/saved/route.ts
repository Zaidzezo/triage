import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/app/lib/prisma"

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getAuthenticatedUserId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.githubId) {
    throw new Error("NOT_AUTHENTICATED")
  }

  const user = await prisma.user.findUnique({
    where: { githubId: session.user.githubId },
    select: { id: true },
  })

  if (!user) {
    throw new Error("USER_NOT_FOUND")
  }

  return user.id
}

function authErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error"
  if (message === "NOT_AUTHENTICATED") {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 })
  }
  if (message === "USER_NOT_FOUND") {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ─── GET /api/saved — Which issues has this user saved? ──────────────────────
// Used by Discover (HomeContent) to pre-highlight the bookmark icons.

export async function GET() {
  let userId: string
  try {
    userId = await getAuthenticatedUserId()
  } catch (err) {
    return authErrorResponse(err)
  }

  try {
    const saved = await prisma.savedIssue.findMany({
      where: { userId },
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
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }
}

// ─── POST /api/saved — Toggle save / unsave ──────────────────────────────────

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

/**
 * Search results from /api/issues may not be persisted as DB rows. If the
 * issueId doesn't resolve, upsert the Issue (and its Repo) from the payload
 * the client sends, then toggle the save against the real row.
 */
async function upsertIssueFromPayload(
  fallbackGithubIssueId: string,
  issue: IncomingIssue,
  repo: IncomingRepo | undefined
): Promise<{ id: string } | null> {
  if (!repo?.fullName || !issue.url || !issue.title) return null

  const githubIssueId = issue.githubIssueId ?? fallbackGithubIssueId

  // If /api/issues ever provides real GitHub repo ids, pass them through in
  // the payload and use them here instead of this synthetic key.
  const githubRepoId = `fullname:${repo.fullName}`
  const ownerLogin = repo.fullName.split("/")[0] ?? "unknown"

  const dbRepo = await prisma.repo.upsert({
    where: { githubRepoId },
    update: {
      stars: repo.stars ?? 0,
      language: repo.language ?? null,
      description: repo.description ?? null,
      lastSyncedAt: new Date(),
    },
    create: {
      githubRepoId,
      fullName: repo.fullName,
      ownerLogin,
      stars: repo.stars ?? 0,
      language: repo.language ?? null,
      description: repo.description ?? null,
    },
  })

  const dbIssue = await prisma.issue.upsert({
    where: { githubIssueId },
    update: { lastSyncedAt: new Date() },
    create: {
      githubIssueId,
      repoId: dbRepo.id,
      number: issue.number ?? 0,
      title: issue.title,
      url: issue.url,
      bodyPreview: issue.bodyPreview ?? null,
      state: issue.state ?? "OPEN",
      authorAssociation: issue.authorAssociation ?? "NONE",
      commentsCount: issue.commentsCount ?? 0,
      isAssigned: issue.isAssigned ?? false,
      hasLinkedPr: issue.hasLinkedPr ?? false,
      createdAt: issue.createdAt ? new Date(issue.createdAt) : new Date(),
    },
    select: { id: true },
  })

  return dbIssue
}

export async function POST(req: NextRequest) {
  // 1. Authenticate
  let userId: string
  try {
    userId = await getAuthenticatedUserId()
  } catch (err) {
    return authErrorResponse(err)
  }

  // 2. Parse body
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const issueId: string = body.issueId?.trim() ?? ""
  if (!issueId) {
    return NextResponse.json({ error: "issueId is required" }, { status: 400 })
  }

  // 3. Resolve the issue — DB id first, otherwise upsert from payload
  let issueRow: { id: string } | null = null
  try {
    issueRow = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true },
    })

    if (!issueRow && body.issue) {
      issueRow = await upsertIssueFromPayload(issueId, body.issue, body.repo)
    }
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  if (!issueRow) {
    return NextResponse.json(
      { error: "Issue not found (no payload to create it from)" },
      { status: 404 }
    )
  }

  const dbIssueId = issueRow.id

  // 4. Toggle inside a transaction — prevents race conditions
  let result: { saved: boolean }
  try {
    result = await prisma.$transaction(async (tx) => {
      const existing = await tx.savedIssue.findFirst({
        where: { userId, issueId: dbIssueId },
        select: { id: true },
      })

      if (existing) {
        await tx.savedIssue.delete({ where: { id: existing.id } })
        return { saved: false }
      }

      await tx.savedIssue.create({
        data: {
          userId,
          issueId: dbIssueId,
          savedAt: new Date(),
        },
      })

      return { saved: true }
    })
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  return NextResponse.json(result)
}