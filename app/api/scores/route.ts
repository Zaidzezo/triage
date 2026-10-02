import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/app/lib/prisma"
import { scoreIssue } from "@/app/lib/scorer"

export async function POST(req: NextRequest) {
  // 1. Parse issue IDs (these are GitHub node IDs, e.g. "I_kwDO...",
  // matching Issue.githubIssueId — NOT Issue.id, which is our internal uuid)
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const githubIssueIds: string[] = body.issueIds ?? []

  if (!Array.isArray(githubIssueIds) || githubIssueIds.length === 0) {
    return NextResponse.json(
      { error: "issueIds must be a non-empty array" },
      { status: 400 }
    )
  }

  if (githubIssueIds.length > 20) {
    return NextResponse.json(
      { error: "Maximum 20 issues per request" },
      { status: 400 }
    )
  }

  // 2. Fetch issues from DB by githubIssueId (only those without a score yet)
  const issues = await prisma.issue.findMany({
    where: {
      githubIssueId: { in: githubIssueIds },
      aiScore: null,
    },
    select: {
      id: true,            // internal uuid — needed for the AiScore relation
      githubIssueId: true, // what the frontend actually sent/expects back
      title: true,
      bodyPreview: true,
    },
  })

  if (issues.length === 0) {
    // All matched issues already scored — fetch and return existing scores,
    // joined through Issue to translate back to githubIssueId
    const existing = await prisma.aiScore.findMany({
      where: {
        issue: { githubIssueId: { in: githubIssueIds } },
      },
      select: {
        difficulty: true,
        explanation: true,
        issue: {
          select: { githubIssueId: true },
        },
      },
    })

    const scores = existing.map((s) => ({
      issueId: s.issue.githubIssueId,
      difficulty: s.difficulty,
      explanation: s.explanation,
    }))

    return NextResponse.json({
      scores,
      meta: { total: githubIssueIds.length, scored: scores.length, failed: 0 },
    })
  }

  // 3. Score each issue, store results
  const results = await Promise.allSettled(
    issues.map(async (issue) => {
      const score = await scoreIssue(issue.title, issue.bodyPreview)

      await prisma.aiScore.create({
        data: {
          issueId: issue.id, // internal uuid, for the relation
          difficulty: score.difficulty,
          explanation: score.explanation,
          provider: "orcarouter",
          model: "deepseek/deepseek-v4-flash-free",
          scoredAt: new Date(),
        },
      })

      return {
        issueId: issue.githubIssueId, // what the frontend matches on
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