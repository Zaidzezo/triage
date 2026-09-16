import { NextRequest, NextResponse } from "next/server";

import { getAccessToken } from "@/app/lib/getAccessToken";
import {
  fetchRepoIssues,
  searchIssues,
  fetchRepositoriesHealth,
  type SearchIssueResult,
} from "@/app/lib/github";
import { prisma } from "@/app/lib/prisma";

// Well-known keywords → their canonical repos.
// When a user searches one of these bare keywords, we also run
// a repo-scoped search so the actual project's issues surface
// instead of being buried by GitHub's relevance ranking.
const KNOWN_REPOS: Record<string, string> = {
  react: "facebook/react",
  "react-native": "facebook/react-native",
  next: "vercel/next.js",
  nextjs: "vercel/next.js",
  "next.js": "vercel/next.js",
  vue: "vuejs/core",
  vuejs: "vuejs/core",
  svelte: "sveltejs/svelte",
  angular: "angular/angular",
  typescript: "microsoft/TypeScript",
  ts: "microsoft/TypeScript",
  vscode: "microsoft/vscode",
  rust: "rust-lang/rust",
  golang: "golang/go",
  go: "golang/go",
  python: "python/cpython",
  node: "nodejs/node",
  nodejs: "nodejs/node",
  deno: "denoland/deno",
  bun: "oven-sh/bun",
  tailwind: "tailwindlabs/tailwindcss",
  prisma: "prisma/prisma",
};

function cleanInput(input: string) {
  return input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/g, "")
    .replace(/^Search\s+/i, "")
    .trim();
}

function isExactRepository(input: string) {
  return input.includes("/") && input.split("/").length === 2;
}

function makeRepoKey(fullName: string) {
  return fullName.toLowerCase();
}

export async function POST(req: NextRequest) {
  // ─────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────

  let accessToken: string;

  try {
    accessToken = await getAccessToken();
  } catch {
    return NextResponse.json(
      { error: "NOT_AUTHENTICATED" },
      { status: 401 }
    );
  }

  // ─────────────────────────────────────
  // Parse request
  // ─────────────────────────────────────

  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const rawInput = body.repo?.trim() ?? "";

  if (!rawInput) {
    return NextResponse.json(
      { error: "Search query is required" },
      { status: 400 }
    );
  }

  const input = cleanInput(rawInput);

  if (!input) {
    return NextResponse.json(
      { error: "Search query is empty" },
      { status: 400 }
    );
  }

  // ─────────────────────────────────────
  // EXACT REPOSITORY MODE
  // ─────────────────────────────────────

  if (isExactRepository(input)) {
    const [owner, repoName] = input.split("/");

    let repository: any;

    try {
      repository = await fetchRepoIssues(owner, repoName, accessToken);
    } catch (error: any) {
      const message = error?.message ?? "";

      if (
        message.includes("401") ||
        message.toLowerCase().includes("unauthorized")
      ) {
        return NextResponse.json(
          { error: "TOKEN_REVOKED" },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: message || "Failed to fetch repository" },
        { status: 500 }
      );
    }

    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const syncTimestamp = new Date();

    // Fire-and-forget DB write — never blocks the response.
    // On Vercel/serverless, prefer `after(() => { ... })` from "next/server"
    // so the runtime is kept alive until this finishes.
    void (async () => {
      try {
        const dbRepo = await prisma.repo.upsert({
          where: { githubRepoId: repository.id },
          update: {
            fullName: repository.nameWithOwner,
            description: repository.description,
            stars: repository.stargazerCount,
            language: repository.primaryLanguage?.name ?? null,
            ownerLogin: owner,
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
        });

        const issues = repository.issues?.nodes ?? [];

        await prisma.$transaction(
          issues.map((issue: any) => {
            const commentsCount = issue.comments?.totalCount ?? 0;
            const isAssigned = (issue.assignees?.nodes?.length ?? 0) > 0;
            const hasLinkedPr =
              issue.timelineItems?.nodes?.some(
                (node: any) => node?.willCloseTarget && node?.source?.id
              ) ?? false;
            const bodyPreview = issue.body ? issue.body.slice(0, 700) : null;

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
            });
          }),
          { timeout: 60_000 }
        );
      } catch (error) {
        console.error("Failed caching repo issues:", error);
      }
    })();

    const repoMeta = {
      fullName: repository.nameWithOwner,
      stars: repository.stargazerCount,
      language: repository.primaryLanguage?.name ?? null,
      description: repository.description,
      health: repository.health,
    };

    return NextResponse.json({
      mode: "repository",
      search: { input: rawInput, resolved: repository.nameWithOwner },
      repos: [repoMeta],
      issues: (repository.issues?.nodes ?? []).map((issue: any) => {
        const commentsCount = issue.comments?.totalCount ?? 0;
        const isAssigned = (issue.assignees?.nodes?.length ?? 0) > 0;
        const hasLinkedPr =
          issue.timelineItems?.nodes?.some(
            (node: any) => node?.willCloseTarget && node?.source?.id
          ) ?? false;

        return {
          id: issue.id,
          githubIssueId: issue.id,
          number: issue.number,
          title: issue.title,
          url: issue.url,
          bodyPreview: issue.body ? issue.body.slice(0, 700) : null,
          state: issue.state,
          authorAssociation: issue.authorAssociation,
          commentsCount,
          isAssigned,
          hasLinkedPr,
          createdAt: issue.createdAt,
          aiScore: null,
          repo: repoMeta,
        };
      }),
    });
  }

  // ─────────────────────────────────────
  // GLOBAL SEARCH MODE
  //
  // Runs two parallel queries when the keyword
  // maps to a well-known repo:
  //   1. Broad keyword search across all of GitHub
  //   2. Repo-scoped search (e.g. repo:facebook/react)
  // Then merges + dedupes, repo-specific results first.
  // ─────────────────────────────────────

  const knownRepo = KNOWN_REPOS[input.toLowerCase()];

  let results: SearchIssueResult[];
  let pagination: { hasNextPage: boolean; endCursor: string | null };

  try {
    const [broadResult, repoResult] = await Promise.all([
      searchIssues(input, accessToken),
      knownRepo
        ? searchIssues(`repo:${knownRepo} is:issue state:open`, accessToken)
        : Promise.resolve(null),
    ]);

    // Merge and deduplicate by issue id — repo-specific results go first
    const seen = new Set<string>();
    const merged: SearchIssueResult[] = [];

    for (const issue of [
      ...(repoResult?.issues ?? []),
      ...broadResult.issues,
    ]) {
      if (!seen.has(issue.id)) {
        seen.add(issue.id);
        merged.push(issue);
      }
    }

    results = merged;

    // Pagination refers to the broad search, which is the
    // open-ended one worth paging through.
    pagination = {
      hasNextPage: broadResult.hasNextPage,
      endCursor: broadResult.endCursor,
    };
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "GitHub issue search failed" },
      { status: 500 }
    );
  }

  if (!results.length) {
    return NextResponse.json({
      mode: "global",
      search: { input: rawInput, resolved: null },
      repos: [],
      issues: [],
      pagination: { hasNextPage: false, endCursor: null },
    });
  }

  // ─────────────────────────────────────
  // Deduplicate repositories
  // ─────────────────────────────────────

  const repoMap = new Map<
    string,
    { owner: string; name: string; fullName: string }
  >();

  for (const issue of results) {
    const fullName = issue.repository.nameWithOwner;

    if (repoMap.size >= 12 && !repoMap.has(makeRepoKey(fullName))) continue;

    const [owner, name] = fullName.split("/");
    repoMap.set(makeRepoKey(fullName), { owner, name, fullName });
  }

  const syncTimestamp = new Date();

  // ─────────────────────────────────────
  // Kick off health fetch immediately
  // ─────────────────────────────────────

  const healthPromise = fetchRepositoriesHealth(
    [...repoMap.values()].map((repo) => ({
      owner: repo.owner,
      name: repo.name,
    })),
    accessToken
  ).catch((error) => {
    console.error("Repository health calculation failed:", error);
    return {} as Record<string, any>;
  });

  // ─────────────────────────────────────
  // Cache issues in database — fire-and-forget, never blocks the response.
  // Batched in chunks of 10 so the cache fills ~10x faster than serial.
  // ─────────────────────────────────────

  void (async () => {
    const CHUNK = 10;

    for (let i = 0; i < results.length; i += CHUNK) {
      await Promise.all(
        results.slice(i, i + CHUNK).map(async (issue) => {
          try {
            const [owner] = issue.repository.nameWithOwner.split("/");

            const dbRepo = await prisma.repo.upsert({
              where: { githubRepoId: issue.repository.id },
              update: {
                fullName: issue.repository.nameWithOwner,
                description: issue.repository.description,
                stars: issue.repository.stars,
                language: issue.repository.language,
                ownerLogin: owner,
                lastSyncedAt: syncTimestamp,
              },
              create: {
                githubRepoId: issue.repository.id,
                fullName: issue.repository.nameWithOwner,
                description: issue.repository.description,
                stars: issue.repository.stars,
                language: issue.repository.language,
                ownerLogin: owner,
                lastSyncedAt: syncTimestamp,
              },
            });

            const bodyPreview = issue.body ? issue.body.slice(0, 700) : null;

            await prisma.issue.upsert({
              where: { githubIssueId: issue.id },
              update: {
                title: issue.title,
                number: issue.number,
                url: issue.url,
                bodyPreview,
                state: issue.state,
                authorAssociation: issue.authorAssociation,
                commentsCount: issue.commentsCount,
                isAssigned: issue.isAssigned,
                hasLinkedPr: issue.hasLinkedPr,
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
                commentsCount: issue.commentsCount,
                isAssigned: issue.isAssigned,
                hasLinkedPr: issue.hasLinkedPr,
                createdAt: new Date(issue.createdAt),
                lastSyncedAt: syncTimestamp,
              },
            });
          } catch (error) {
            console.error("Failed caching issue:", error);
          }
        })
      );
    }
  })();

  // Health is part of the response, so we await it — but the DB writes
  // above now run concurrently with this wait instead of serially after it.
  const healthMap = await healthPromise;

  // ─────────────────────────────────────
  // Final response
  // ─────────────────────────────────────

  const finalIssues = results.map((issue) => {
    const fullName = issue.repository.nameWithOwner;

    return {
      id: issue.id,
      githubIssueId: issue.id,
      number: issue.number,
      title: issue.title,
      url: issue.url,
      bodyPreview: issue.body,
      state: issue.state,
      authorAssociation: issue.authorAssociation,
      commentsCount: issue.commentsCount,
      isAssigned: issue.isAssigned,
      hasLinkedPr: issue.hasLinkedPr,
      createdAt: issue.createdAt,
      aiScore: null,
      repo: {
        fullName,
        stars: issue.repository.stars,
        language: issue.repository.language,
        description: issue.repository.description,
        health:
          healthMap[fullName] ?? {
            reviewedInLast10: false,
            pullRequestsChecked: 0,
            reviewedPullRequests: 0,
          },
      },
    };
  });

  const repoSummary = [...repoMap.values()].map((repo) => {
    const matchingIssue = results.find(
      (issue) =>
        issue.repository.nameWithOwner.toLowerCase() ===
        repo.fullName.toLowerCase()
    );

    return {
      fullName: repo.fullName,
      stars: matchingIssue?.repository.stars ?? 0,
      language: matchingIssue?.repository.language ?? null,
      description: matchingIssue?.repository.description ?? null,
      health:
        healthMap[repo.fullName] ?? {
          reviewedInLast10: false,
          pullRequestsChecked: 0,
          reviewedPullRequests: 0,
        },
    };
  });

  return NextResponse.json({
    mode: "global",
    search: {
      input: rawInput,
      resolved: knownRepo ?? null,
    },
    repos: repoSummary,
    issues: finalIssues,
    pagination,
  });
}