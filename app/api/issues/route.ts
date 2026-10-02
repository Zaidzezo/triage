import { NextRequest, NextResponse } from "next/server";

import { getAccessToken } from "@/app/lib/getAccessToken";
import {
  fetchRepoMetadata,
  searchIssues,
  searchRepositories,
  type RepoMetadata,
  type SearchIssueResult,
} from "@/app/lib/github";
import { prisma } from "@/app/lib/prisma";

// ─────────────────────────────────────
// SEARCH LIMITS
// ─────────────────────────────────────

const MAX_RESULTS = 80;        // global mode cap
const MAX_REPO_ISSUES = 100;    // exact-repo mode cap
const MAX_GITHUB_PAGES = 10;     // global mode safety limit

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
  //   months, repo >= 1000 stars.
  //
  // We loop at most 2 pages (2 × 50 = 100)
  // and stop as soon as we have enough —
  // normally a single request, well under
  // the 16-second budget.
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
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

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

        let dups = 0, lowStars = 0, tooOld = 0, kept = 0;

        for (const issue of githubResult.issues) {
  if (seenIssueIds.has(issue.id)) { dups++; continue; }
  if ((issue.repository.stars ?? 0) < 1000) { lowStars++; continue; }
  // if (new Date(issue.createdAt) < sixMonthsAgo) { tooOld++; continue; }
  seenIssueIds.add(issue.id);
  results.push(issue);
  kept++;
  if (results.length >= MAX_RESULTS) break;
}

console.log(
  `page ${page}: got=${githubResult.issues.length} kept=${kept} dups=${dups} lowStars=${lowStars} tooOld=${tooOld} total=${results.length}`
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
  // We fetch GitHub pages of 50 raw
  // search results and continue until:
  //
  //   1. We collect 200 qualifying issues
  //   OR
  //   2. GitHub has no more results
  //   OR
  //   3. We reach the safety limit
  //
  // Qualifying issue (all enforced by
  // GitHub server-side):
  //
  //   - open
  //   - unassigned
  //   - created in the last 6 months
  //   - repository >= 1000 stars
  //
  // The frontend then displays these 200
  // locally at 30 issues per page.
  // ─────────────────────────────────────

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  let results: SearchIssueResult[] = [];
  let githubHasNextPage = true;
  let githubCursor: string | undefined;
  const seenIssueIds = new Set<string>();

  try {
    for (let page = 0; page < MAX_GITHUB_PAGES; page++) {
      if (!githubHasNextPage || results.length >= MAX_RESULTS) break;

      const githubResult = await searchIssues(input, accessToken, githubCursor);

      // ─── DEBUG: trace cursor + id drift across pages ───
      console.log(
        `page ${page}: cursor_in=${githubCursor ?? "null"} cursor_out=${githubResult.endCursor} ` +
        `first_id=${githubResult.issues[0]?.id} last_id=${githubResult.issues.at(-1)?.id}`
      );

      let dups = 0, lowStars = 0, kept = 0;

            for (const issue of githubResult.issues) {
        if (seenIssueIds.has(issue.id)) { dups++; continue; }
        // Defensive re-checks — GitHub already applies these
        // server-side, but they cost nothing client-side.
        if ((issue.repository.stars ?? 0) < 1000) {
          lowStars++;
          if (lowStars <= 5) {
            console.log(
              `  rejected: ${issue.repository.nameWithOwner} stars=${issue.repository.stars}`
            );
          }
          continue;
        }
        // if (new Date(issue.createdAt) < sixMonthsAgo) continue;
        seenIssueIds.add(issue.id);
        results.push(issue);
        kept++;
        if (results.length >= MAX_RESULTS) break;
      }

      // ─── DEBUG: per-page filter breakdown ───
      console.log(
        `page ${page}: raw=${githubResult.issues.length} kept=${kept} dups=${dups} lowStars=${lowStars} runningTotal=${results.length}`
      );

      githubHasNextPage = githubResult.hasNextPage;
      githubCursor = githubResult.endCursor ?? undefined;

      if (!githubCursor) break;
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

  // Hard cap.
  results = results.slice(0, MAX_RESULTS);

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
    pagination: {
      hasNextPage: githubHasNextPage,
      endCursor: githubCursor ?? null,
    },
  });
}