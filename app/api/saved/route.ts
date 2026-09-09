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

// ─── POST /api/saved — Toggle save / unsave ──────────────────────────────────

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

  // 3. Verify issue exists
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true },
  })

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 })
  }

  // 4. Toggle inside a transaction — prevents race conditions
  let result: { saved: boolean }
  try {
    result = await prisma.$transaction(async (tx) => {
      const existing = await tx.savedIssue.findFirst({
        where: { userId, issueId },
        select: { id: true },
      })

      if (existing) {
        await tx.savedIssue.delete({
          where: { id: existing.id },
        })
        return { saved: false }
      }

      await tx.savedIssue.create({
        data: {
          userId,
          issueId,
          savedAt: new Date(),
        },
      })

      return { saved: true }
    })
  } catch {
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    )
  }

  return NextResponse.json(result)
}

// ─── GET /api/saved — List saved issues with full card data ──────────────────

export async function GET(req: NextRequest) {
  // 1. Authenticate
  let userId: string
  try {
    userId = await getAuthenticatedUserId()
  } catch (err) {
    return authErrorResponse(err)
  }

  // 2. Extract optional search query
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() ?? ""

  // 3. Fetch saved issues — filter by search query if provided
  let savedIssues: any[]
  try {
    savedIssues = await prisma.savedIssue.findMany({
      where: {
        userId,
        ...(q && {
          issue: {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { bodyPreview: { contains: q, mode: "insensitive" } },
              { repo: { fullName: { contains: q, mode: "insensitive" } } },
            ],
          },
        }),
      },
      orderBy: { savedAt: "desc" },
      select: {
        savedAt: true,
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
                fullName: true,
                language: true,
                stars: true,
              },
            },
          },
        },
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    )
  }

  return NextResponse.json({ saved: savedIssues })
}