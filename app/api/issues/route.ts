import { NextRequest, NextResponse } from "next/server";

import { getAccessToken } from "@/app/lib/getAccessToken";
import {
  chunkRepoScope,
  fetchRepoMetadata,
  searchIssues,
  searchRepositories,
  type RepoMetadata,
  type SearchIssueResult,
  type SearchIssuesPage,
} from "@/app/lib/github";
import { prisma } from "@/app/lib/prisma";

// ─────────────────────────────────────
// SEARCH LIMITS
// ─────────────────────────────────────

const MAX_RESULTS = 120;         // global mode cap (was 80)
const MAX_PER_REPO = 2;          // global mode: max issues from one repo
const MAX_REPO_ISSUES = 100;     // exact-repo mode cap
const REPO_POOL_SIZE = 100;      // qualifying repos to pull (was 60; GitHub's max per page is 100)
const MAX_ISSUE_QUERIES = 16;    // parallel issue queries (was 10)
const ISSUES_PER_QUERY = 50;     // issues requested per parallel query

// ─────────────────────────────────────
// HELPERS
// ─────────────────────────────────────

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

function makeBodyPreview(body: string | null) {
  return body ? body.slice(0, 700) : null;
}

function toApiIssue(issue: SearchIssueResult, repoMeta: {
  fullName: string;
  stars: number;
  language: string | null;
  description: string | null;
}) {
  return {
    id: issue.id,
    githubIssueId: issue.id,
    number: issue.number,
    title: issue.title,
    url: issue.url,
    bodyPreview: makeBodyPreview(issue.body),
    state: issue.state,
    authorAssociation: issue.authorAssociation,
    commentsCount: issue.commentsCount,
    isAssigned: issue.isAssigned,
    hasLinkedPr: issue.hasLinkedPr,
    createdAt: issue.createdAt,
    aiScore: null,
    repo: repoMeta,
  };
}

function isAuthError(message: string) {
  return (
    message.includes("401") ||
    message.includes("403") ||
    message.toLowerCase().includes("unauthorized") ||
    message.toLowerCase().includes("bad credentials")
  );
}

// ─────────────────────────────────────
// BACKGROUND DATABASE CACHE
// ─────────────────────────────────────

async function cacheIssues(
  issues: SearchIssueResult[],
  repoMetaByFullName: Map<string, RepoMetadata>,
  syncTimestamp: Date
) {
  try {
    const CHUNK = 10;

    for (let i = 0; i < issues.length; i += CHUNK) {
      await Promise.all(
        issues.slice(i, i + CHUNK).map(async (issue) => {
          try {
            const [owner] = issue.repository.nameWithOwner.split("/");
            const meta = repoMetaByFullName.get(
              issue.repository.nameWithOwner
            );

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

            await prisma.issue.upsert({
              where: { githubIssueId: issue.id },
              update: {
                title: issue.title,
                number: issue.number,
                url: issue.url,
                bodyPreview: makeBodyPreview(issue.body),
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
                bodyPreview: makeBodyPreview(issue.body),
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
  } catch (error) {
    console.error("Failed caching issues:", error);
  }
}

// ─────────────────────────────────────
// POST
// ─────────────────────────────────────

export async function POST(req: NextRequest) {
  // ─────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────

  let accessToken: string;

  try {
    accessToken = await getAccessToken();
  } catch {
    return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  // ─────────────────────────────────────
  // Parse request
  // ─────────────────────────────────────

  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
  //
  // GitHub enforces server-side:
  //   open, unassigned, created in last 6
  //   months. Repo >= 1000 stars is checked
  //   up front via fetchRepoMetadata.
  //
  // We loop at most 2 pages and stop as
  // soon as we have enough. The per-repo
  // cap does not apply here, since every
  // issue comes from the one repo asked for.
  // ─────────────────────────────────────

  if (isExactRepository(input)) {
    const [owner, repoName] = input.split("/");

    let repo: RepoMetadata;

    try {
      repo = await fetchRepoMetadata(owner, repoName, accessToken);
    } catch (error: any) {
      const message = error?.message ?? "";

      if (isAuthError(message)) {
        return NextResponse.json({ error: "TOKEN_REVOKED" }, { status: 401 });
      }

      if (message.includes("not found") || message.includes("404")) {
        return NextResponse.json(
          { error: "Repository not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: message || "Failed to fetch repository" },
        { status: 500 }
      );
    }

    // Only repositories with 1000+ stars are allowed.
    if (repo.stars < 1000) {
      return NextResponse.json({
        mode: "repository",
        search: { input: rawInput, resolved: repo.nameWithOwner },
        repos: [],
        issues: [],
        pagination: { hasNextPage: false, endCursor: null },
      });
    }

    const results: SearchIssueResult[] = [];
    const seenIssueIds = new Set<string>();
    let cursor: string | undefined;
    let hasNextPage = true;

    try {
      for (
        let page = 0;
        page < 2 && hasNextPage && results.length < MAX_REPO_ISSUES;
        page++
      ) {
        const githubResult = await searchIssues(
          `repo:${owner}/${repoName}`,
          accessToken,
          cursor
        );

        let dups = 0, lowStars = 0, kept = 0;

        for (const issue of githubResult.issues) {
          if (seenIssueIds.has(issue.id)) { dups++; continue; }
          if ((issue.repository.stars ?? 0) < 1000) { lowStars++; continue; }
          seenIssueIds.add(issue.id);
          results.push(issue);
          kept++;
          if (results.length >= MAX_REPO_ISSUES) break;
        }

        console.log(
          `page ${page}: got=${githubResult.issues.length} kept=${kept} dups=${dups} lowStars=${lowStars} total=${results.length}`
        );

        hasNextPage = githubResult.hasNextPage;
        cursor = githubResult.endCursor ?? undefined;
      }
    } catch (error: any) {
      const message = error?.message ?? "";

      if (isAuthError(message)) {
        return NextResponse.json({ error: "TOKEN_REVOKED" }, { status: 401 });
      }

      return NextResponse.json(
        { error: message || "GitHub issue search failed" },
        { status: 500 }
      );
    }

    const repoMeta = {
      fullName: repo.nameWithOwner,
      stars: repo.stars,
      language: repo.language,
      description: repo.description,
    };

    const syncTimestamp = new Date();

    // ─────────────────────────────────────
    // Background database cache
    // ─────────────────────────────────────

    const repoMetaByFullName = new Map<string, RepoMetadata>();
    repoMetaByFullName.set(repo.nameWithOwner, repo);

    void cacheIssues(results, repoMetaByFullName, syncTimestamp);

    return NextResponse.json({
      mode: "repository",
      search: { input: rawInput, resolved: repo.nameWithOwner },
      repos: [repoMeta],
      issues: results.map((issue) => toApiIssue(issue, repoMeta)),
      pagination: {
        hasNextPage: hasNextPage && results.length >= MAX_REPO_ISSUES,
        endCursor: cursor ?? null,
      },
    });
  }

  // ─────────────────────────────────────
  // GLOBAL SEARCH MODE
  //
  // Phase 1: find a pool of qualifying repos
  //          (1 fast REST call, stars filter
  //          works on repo search).
  // Phase 2: split the pool into small groups
  //          that fit GitHub's query length
  //          limit and search issues for all
  //          groups in parallel.
  // Phase 3: merge, newest first, and keep at
  //          most MAX_PER_REPO issues per repo
  //          so results spread across repos.
  // ─────────────────────────────────────

  // ─── Phase 1: qualifying repos ───
  let repoNames: string[] = [];

  try {
    const repos = await searchRepositories(input, accessToken, {
      minStars: 1000,
      perPage: REPO_POOL_SIZE,
    });
    repoNames = repos.map((r) => r.full_name);
  } catch (error: any) {
    const message = error?.message ?? "";

    if (isAuthError(message)) {
      return NextResponse.json({ error: "TOKEN_REVOKED" }, { status: 401 });
    }

    return NextResponse.json(
      { error: message || "GitHub repository search failed" },
      { status: 500 }
    );
  }

  if (!repoNames.length) {
    return NextResponse.json({
      mode: "global",
      search: { input: rawInput, resolved: null },
      repos: [],
      issues: [],
      pagination: { hasNextPage: false, endCursor: null },
    });
  }

  // ─── Phase 2: parallel issue queries ───
  const scopeChunks = chunkRepoScope(repoNames).slice(0, MAX_ISSUE_QUERIES);

  const settled = await Promise.allSettled(
    scopeChunks.map((repoScope) =>
      searchIssues(input, accessToken, undefined, {
        repoScope,
        pageSize: ISSUES_PER_QUERY,
      })
    )
  );

  const fetchedPages: SearchIssuesPage[] = [];
  let firstError: any = null;

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      fetchedPages.push(outcome.value);
    } else if (!firstError) {
      firstError = outcome.reason;
    }
  }

  // Only fail the request if every query failed.
  if (!fetchedPages.length && firstError) {
    const message = firstError?.message ?? "";

    if (isAuthError(message)) {
      return NextResponse.json({ error: "TOKEN_REVOKED" }, { status: 401 });
    }

    return NextResponse.json(
      { error: message || "GitHub issue search failed" },
      { status: 500 }
    );
  }

  // ─── Phase 3: merge + per-repo cap ───
  const allIssues = fetchedPages
    .flatMap((page) => page.issues)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const results: SearchIssueResult[] = [];
  const seenIssueIds = new Set<string>();
  const perRepoCount = new Map<string, number>();

  for (const issue of allIssues) {
    if (seenIssueIds.has(issue.id)) continue;
    // Safety net — scoped repos should already be 1000+ stars.
    if ((issue.repository.stars ?? 0) < 1000) continue;

    const repoKey = makeRepoKey(issue.repository.nameWithOwner);
    const count = perRepoCount.get(repoKey) ?? 0;
    if (count >= MAX_PER_REPO) continue;

    perRepoCount.set(repoKey, count + 1);
    seenIssueIds.add(issue.id);
    results.push(issue);

    if (results.length >= MAX_RESULTS) break;
  }

  console.log(
    `[global] repoPool=${repoNames.length} queries=${scopeChunks.length} ` +
    `fetched=${allIssues.length} kept=${results.length} distinctRepos=${perRepoCount.size}`
  );

  // ─────────────────────────────────────
  // No results
  // ─────────────────────────────────────

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
    const key = makeRepoKey(fullName);
    if (repoMap.has(key)) continue;

    const [owner, name] = fullName.split("/");
    repoMap.set(key, { owner, name, fullName });
  }

  const syncTimestamp = new Date();

  // ─────────────────────────────────────
  // Background database cache
  // ─────────────────────────────────────

  const repoMetaByFullName = new Map<string, RepoMetadata>();
  for (const issue of results) {
    if (!repoMetaByFullName.has(issue.repository.nameWithOwner)) {
      repoMetaByFullName.set(issue.repository.nameWithOwner, {
        id: issue.repository.id,
        nameWithOwner: issue.repository.nameWithOwner,
        description: issue.repository.description,
        stars: issue.repository.stars,
        language: issue.repository.language,
      });
    }
  }

  void cacheIssues(results, repoMetaByFullName, syncTimestamp);

  // ─────────────────────────────────────
  // Final issues
  // ─────────────────────────────────────

  const finalIssues = results.map((issue) =>
    toApiIssue(issue, {
      fullName: issue.repository.nameWithOwner,
      stars: issue.repository.stars,
      language: issue.repository.language,
      description: issue.repository.description,
    })
  );

  // ─────────────────────────────────────
  // Repository summaries
  // ─────────────────────────────────────

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
    };
  });

  // ─────────────────────────────────────
  // Final response
  // ─────────────────────────────────────

  return NextResponse.json({
    mode: "global",
    search: { input: rawInput, resolved: null },
    repos: repoSummary,
    issues: finalIssues,
    pagination: { hasNextPage: false, endCursor: null },
  });
}