import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/lib/prisma"
import { scoreIssue } from "@/app/lib/scorer"

interface ScoresRequest {
  issueIds: string[]
}

interface ScoreResponse {
  issueId: string
  difficulty: string
  explanation: string
}

function isScoresRequest(body: unknown): body is ScoresRequest {
  if (!body || typeof body !== "object") {
    return false
  }

  const value = body as Record<string, unknown>

  return (
    Array.isArray(value.issueIds) &&
    value.issueIds.every(
      (id): id is string => typeof id === "string"
    )
  )
}

export async function POST(req: NextRequest) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (!isScoresRequest(body) || body.issueIds.length === 0) {
    return NextResponse.json(
      { error: "issueIds must be a non-empty array of strings" },
      { status: 400 }
    )
  }

  const githubIssueIds = body.issueIds

  if (githubIssueIds.length > 20) {
    return NextResponse.json(
      { error: "Maximum 20 issues per request" },
      { status: 400 }
    )
  }

  let issues

  try {
    issues = await prisma.issue.findMany({
      where: {
        githubIssueId: { in: githubIssueIds },
        aiScore: null,
      },
      select: {
        id: true,
        githubIssueId: true,
        title: true,
        bodyPreview: true,
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    )
  }

  if (issues.length === 0) {
    try {
      const existing = await prisma.aiScore.findMany({
        where: {
          issue: {
            githubIssueId: {
              in: githubIssueIds,
            },
          },
        },
        select: {
          difficulty: true,
          explanation: true,
          issue: {
            select: {
              githubIssueId: true,
            },
          },
        },
      })

      const scores: ScoreResponse[] = existing.map((score) => ({
        issueId: score.issue.githubIssueId,
        difficulty: score.difficulty,
        explanation: score.explanation,
      }))

      return NextResponse.json({
        scores,
        meta: {
          total: githubIssueIds.length,
          scored: scores.length,
          failed: 0,
        },
      })
    } catch {
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      )
    }
  }

  const results = await Promise.allSettled(
    issues.map(async (issue): Promise<ScoreResponse> => {
      const score = await scoreIssue(
        issue.title,
        issue.bodyPreview
      )

      await prisma.aiScore.create({
        data: {
          issueId: issue.id,
          difficulty: score.difficulty,
          explanation: score.explanation,
          provider: "orcarouter",
          model: "deepseek/deepseek-v4-flash-free",
          scoredAt: new Date(),
        },
      })

      return {
        issueId: issue.githubIssueId,
        difficulty: score.difficulty,
        explanation: score.explanation,
      }
    })
  )

  const scores = results
    .filter(
      (
        result
      ): result is PromiseFulfilledResult<ScoreResponse> =>
        result.status === "fulfilled"
    )
    .map((result) => result.value)

  const failures = results.filter(
    (result): result is PromiseRejectedResult =>
      result.status === "rejected"
  )

  if (failures.length > 0) {
    console.error(
      `Failed to score ${failures.length} issue(s)`
    )
  }

  return NextResponse.json({
    scores,
    meta: {
      total: issues.length,
      scored: scores.length,
      failed: failures.length,
    },
  })
}