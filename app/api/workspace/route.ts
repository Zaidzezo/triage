import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/app/lib/prisma"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUSES = [
  "SAVED",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

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

// ─── GET /api/workspace — List tracked issues with full card data ────────────

export async function GET(req: NextRequest) {
  // 1. Authenticate
  let userId: string
  try {
    userId = await getAuthenticatedUserId()
  } catch (err) {
    return authErrorResponse(err)
  }

  // 2. Fetch saved issues (status included)
  let savedIssues: any[]
  try {
    savedIssues = await prisma.savedIssue.findMany({
      where: { userId },
      orderBy: { savedAt: "desc" },
      select: {
        savedAt: true,
        status: true,
        issue: {
          select: {
            id: true,
            number: true,
            title: true,
            url: true,
            bodyPreview: true,
            state: true,
            authorAssociation: true,
            commentsCount: true,
            isAssigned: true,
            hasLinkedPr: true,
            createdAt: true,
            aiScore: {
              select: {
                difficulty: true,
                explanation: true,
              },
            },
            repo: {
              select: {
                id: true,
                fullName: true,
                language: true,
                stars: true,
                ownerLogin: true,
              },
            },
          },
        },
      },
    })
  }  catch (e) {
    console.error("[/api/workspace GET] findMany failed:", e)
    return NextResponse.json(
      {
        error: "Database error",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    )
  }

  /*
   * No GitHub health requests here — the workspace should load fast.
   * Health is "not checked" unless the repo was part of a recent search.
   */
  const saved = savedIssues.map((item) => ({
    savedAt: item.savedAt,
    status: item.status,
    issue: {
      ...item.issue,
      repo: {
        ...item.issue.repo,
        health: {
          reviewedInLast10: false,
          pullRequestsChecked: 0,
          reviewedPullRequests: 0,
        },
      },
    },
  }))

  return NextResponse.json({ saved })
}

// ─── PATCH /api/workspace — Move an issue between columns ────────────────────

export async function PATCH(req: NextRequest) {
  // 1. Authenticate
  let userId: string
  try {
    userId = await getAuthenticatedUserId()
  } catch (err) {
    return authErrorResponse(err)
  }

  // 2. Parse + validate body
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const issueId: string = body.issueId?.trim() ?? ""
  const status: string = body.status ?? ""

  if (!issueId) {
    return NextResponse.json({ error: "issueId is required" }, { status: 400 })
  }
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${STATUSES.join(", ")}` },
      { status: 400 }
    )
  }

  // 3. Verify the saved issue belongs to this user
  const savedIssue = await prisma.savedIssue.findFirst({
    where: { userId, issueId },
    select: { id: true },
  })

  if (!savedIssue) {
    return NextResponse.json({ error: "Saved issue not found" }, { status: 404 })
  }

  // 4. Update status
  try {
    await prisma.savedIssue.update({
      where: { id: savedIssue.id },
      data: { status },
    })
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status })
}