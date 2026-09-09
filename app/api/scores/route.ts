import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/lib/prisma"
import { scoreIssue } from "@/app/lib/scorer"

export async function POST(req: NextRequest) {
  // 1. Parse issue IDs
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const issueIds: string[] = body.issueIds ?? []

  if (!Array.isArray(issueIds) || issueIds.length === 0) {
    return NextResponse.json(
      { error: "issueIds must be a non-empty array" },
      { status: 400 }
    )
  }

  if (issueIds.length > 20) {
    return NextResponse.json(
      { error: "Maximum 20 issues per request" },
      { status: 400 }
    )
  }

  // 2. Fetch issues from DB (only those without a score yet)
  const issues = await prisma.issue.findMany({
    where: {
      id: { in: issueIds },
      aiScore: null,
    },
    select: {
      id: true,
      title: true,
      bodyPreview: true,
    },
  })

  if (issues.length === 0) {
    // All issues already scored — fetch and return existing scores
    const existing = await prisma.aiScore.findMany({
      where: { issueId: { in: issueIds } },
      select: {
        issueId: true,
        difficulty: true,
        explanation: true,
      },
    })
    return NextResponse.json({
      scores: existing,
      meta: { total: issueIds.length, scored: existing.length, failed: 0 },
    })
  }

  // 3. Score each issue, store results
  const results = await Promise.allSettled(
    issues.map(async (issue) => {
      const score = await scoreIssue(issue.title, issue.bodyPreview)

      await prisma.aiScore.create({
        data: {
          issueId: issue.id,
          difficulty: score.difficulty,
          explanation: score.explanation,
          provider: "b.ai",
          model: "glm-5.3-flash",
          scoredAt: new Date(),
        },
      })

      return {
        issueId: issue.id,
        difficulty: score.difficulty,
        explanation: score.explanation,
      }
    })
  )

  // 4. Separate successes from failures
  const scores = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<any>).value)

  const failures = results
    .filter((r) => r.status === "rejected")
    .map((r) => (r as PromiseRejectedResult).reason?.message ?? "Unknown error")

  if (failures.length > 0) {
    console.error("Scoring failures:", failures)
  }

  return NextResponse.json({
    scores,
    meta: {
      total: issues.length,
      scored: scores.length,
      failed: failures.length,
      ...(failures.length > 0 && { errors: failures }),
    },
  })
}