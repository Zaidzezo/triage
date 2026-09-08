import { NextRequest, NextResponse } from "next/server"
import { getAccessToken } from "@/app/lib/getAccessToken"
import { fetchRepoIssues } from "@/app/lib/github"
import { prisma } from "@/app/lib/prisma"

export async function POST(req: NextRequest) {
  // 1. Authenticate Request
  let accessToken: string
  try {
    accessToken = await getAccessToken()
  } catch {
    return NextResponse.json(
      { error: "NOT_AUTHENTICATED" },
      { status: 401 }
    )
  }

  // 2. Parse & Normalize Request Body
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid or empty JSON body" },
      { status: 400 }
    )
  }

  const rawInput: string = body.repo?.trim() ?? ""
  if (!rawInput) {
    return NextResponse.json(
      { error: "Repository input is required" },
      { status: 400 }
    )
  }

  // Normalize input (handles "owner/repo", full URLs, ".git" suffixes, and trailing slashes)
  const cleanInput = rawInput
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$|^Search /g, "")
    .trim()

  if (!cleanInput.includes("/")) {
    return NextResponse.json(
      { error: "Invalid repo format. Use owner/repo or full GitHub URL" },
      { status: 400 }
    )
  }

  const [owner, repo] = cleanInput.split("/")

  // 3. Fetch Repository & Issues from GitHub API
  let repository: any
  try {
    repository = await fetchRepoIssues(owner, repo, accessToken)
  } catch (error: any) {
    if (error.message?.includes("401") || error.message?.includes("UNAUTHORIZED")) {
      return NextResponse.json(
        { error: "TOKEN_REVOKED" },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: error.message ?? "Failed to fetch repository" },
      { status: 500 }
    )
  }

  const syncTimestamp = new Date()

  // 4. Upsert Parent Repository in Database
  const dbRepo = await prisma.repo.upsert({
    where: { githubRepoId: repository.id },
    update: {
      description: repository.description,
      stars: repository.stargazerCount,
      language: repository.primaryLanguage?.name ?? null,
      lastSyncedAt: syncTimestamp,
    },
    create: {
      githubRepoId: repository.id,
      fullName: repository.nameWithOwner,
      description: repository.description,
      stars: repository.stargazerCount,
      language: repository.primaryLanguage?.name ?? null,
      ownerLogin: owner,
      lastSyncedAt: syncTimestamp,
    },
  })

  // 5. Batch Upsert Issues using Prisma Transaction
  const issues = repository.issues?.nodes ?? []

  const issueOperations = issues.map((issue: any) => {
    const commentsCount = issue.comments?.totalCount ?? 0
    const isAssigned = (issue.assignees?.nodes?.length ?? 0) > 0
    const hasLinkedPr = issue.timelineItems?.nodes?.some(
      (node: any) => node?.willCloseTarget && node?.source?.id
    ) ?? false
    const bodyPreview = issue.body ? issue.body.slice(0, 500) : null

    return prisma.issue.upsert({
      where: { githubIssueId: issue.id },
      update: {
        title: issue.title,
        number: issue.number,
        url: issue.url,
        bodyPreview,
        state: issue.state,
        authorAssociation: issue.authorAssociation,
        commentsCount,
        isAssigned,
        hasLinkedPr,
        lastSyncedAt: syncTimestamp,
      },
      create: {
        githubIssueId: issue.id,
        repoId: dbRepo.id,
        title: issue.title,
        number: issue.number,
        url: issue.url,
        bodyPreview,
        state: issue.state,
        authorAssociation: issue.authorAssociation,
        commentsCount,
        isAssigned,
        hasLinkedPr,
        createdAt: new Date(issue.createdAt),
        lastSyncedAt: syncTimestamp,
      },
    })
  })

  await prisma.$transaction(issueOperations, {
    timeout: 60_000
  })
  // 6. Return Structured DB Response
  const dbIssues = await prisma.issue.findMany({
    where: { repoId: dbRepo.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      githubIssueId: true,
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
    },
  })

  return NextResponse.json({
    repo: {
      id: dbRepo.id,
      fullName: repository.nameWithOwner,
      description: repository.description,
      stars: repository.stargazerCount,
      language: repository.primaryLanguage?.name ?? null,
    },
    issues: dbIssues,
  })
}