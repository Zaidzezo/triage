import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/app/lib/prisma"

const STATUSES = [
  "SAVED",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
] as const

type Status = (typeof STATUSES)[number]

interface WorkspaceRequest {
  issueId: string
  status: Status
}

function isWorkspaceRequest(
  body: unknown
): body is WorkspaceRequest {
  if (!body || typeof body !== "object") {
    return false
  }

  const value = body as Record<string, unknown>

  return (
    typeof value.issueId === "string" &&
    value.issueId.trim().length > 0 &&
    typeof value.status === "string" &&
    STATUSES.includes(value.status as Status)
  )
}

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

export async function GET() {
  let userId: string

  try {
    userId = await getAuthenticatedUserId()
  } catch (error) {
    return authErrorResponse(error)
  }

  try {
    const savedIssues = await prisma.savedIssue.findMany({
      where: {
        userId,
      },

      orderBy: {
        savedAt: "desc",
      },

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
  } catch {
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
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

  if (!isWorkspaceRequest(body)) {
    return NextResponse.json(
      {
        error:
          "issueId and a valid status are required",
        validStatuses: STATUSES,
      },
      { status: 400 }
    )
  }

  const issueId = body.issueId.trim()
  const status = body.status

  let savedIssue: { id: string } | null

  try {
    savedIssue = await prisma.savedIssue.findFirst({
      where: {
        userId,
        issueId,
      },
      select: {
        id: true,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    )
  }

  if (!savedIssue) {
    return NextResponse.json(
      { error: "Saved issue not found" },
      { status: 404 }
    )
  }

  try {
    await prisma.savedIssue.update({
      where: {
        id: savedIssue.id,
      },
      data: {
        status,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    status,
  })
}