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

const MAX_RESULTS = 150;         // global mode cap
const MAX_PER_REPO = 2;          // global mode: max issues from one repo
const MAX_REPO_ISSUES = 100;     // exact-repo mode cap
const REPOS_PER_BAND = 20;       // repos pulled from each star band
const MAX_ISSUE_QUERIES = 20;    // parallel issue queries in global mode
const ISSUES_PER_QUERY = 50;     // issues requested per parallel query
const MIN_STARS = 1000;          // repos need at least this many stars
const MAX_STARS = 50000;         // ...and fewer than this many

// Global search samples repos from each of these star bands, so results
// mix small, medium and huge repos. Min is inclusive, max is exclusive.
const STAR_EDGES = [MIN_STARS, 3000, 7000, 15000, 30000, MAX_STARS];
const STAR_BANDS = STAR_EDGES.slice(0, -1).map((min, i) => ({
  min,
  max: STAR_EDGES[i + 1],
}));

function bandIndex(stars: number) {
  return STAR_BANDS.findIndex((b) => stars >= b.min && stars < b.max);
}

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
  //   months. Repo star range (1000 to
  //   49,999) is checked up front via
  //   fetchRepoMetadata.
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

    // Only repositories with 1000 to 49,999 stars are allowed.
    if (repo.stars < MIN_STARS || repo.stars >= MAX_STARS) {
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
          const issueStars = issue.repository.stars ?? 0;
          if (issueStars < MIN_STARS || issueStars >= MAX_STARS) { lowStars++; continue; }
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
  // Phase 1: find repos in every star band
  //          (one REST search per band, run
  //          in parallel), so small, medium
  //          and huge repos are all in the
  //          pool.
  // Phase 2: split each band's repos into
  //          small groups that fit GitHub's
  //          query length limit and search
  //          issues for all groups in
  //          parallel.
  // Phase 3: cap issues per repo, then pick
  //          round-robin across the bands so
  //          no size dominates.
  // ─────────────────────────────────────

  // ─── Phase 1: qualifying repos, one search per star band ───
  // A single search sorted by stars only returns the biggest repos.
  // Searching each band separately puts all sizes in the pool.
  const bandSearches = await Promise.allSettled(
    STAR_BANDS.map((band) =>
      searchRepositories(input, accessToken, {
        minStars: band.min,
        maxStars: band.max,
        perPage: REPOS_PER_BAND,
      })
    )
  );

  const reposByBand: string[][] = [];
  let repoSearchError: any = null;

  for (const outcome of bandSearches) {
    if (outcome.status === "fulfilled") {
      reposByBand.push(outcome.value.map((r) => r.full_name));
    } else {
      reposByBand.push([]);
      if (!repoSearchError) repoSearchError = outcome.reason;
    }
  }

  const totalRepos = reposByBand.reduce((sum, names) => sum + names.length, 0);

  if (!totalRepos) {
    if (repoSearchError) {
      const message = repoSearchError?.message ?? "";

      if (isAuthError(message)) {
        return NextResponse.json({ error: "TOKEN_REVOKED" }, { status: 401 });
      }

      return NextResponse.json(
        { error: message || "GitHub repository search failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      mode: "global",
      search: { input: rawInput, resolved: null },
      repos: [],
      issues: [],
      pagination: { hasNextPage: false, endCursor: null },
    });
  }

  // ─── Phase 2: parallel issue queries ───
  // Repos are chunked per band, so a small repo is never crowded out by
  // a busy huge repo in the same query (results come back newest-first).
  // Chunks from all bands are interleaved, so if the cap cuts any off,
  // it cuts evenly.
  const chunksByBand = reposByBand.map((names) => chunkRepoScope(names));
  const interleavedChunks: string[][] = [];

  for (let i = 0; ; i++) {
    let added = false;
    for (const chunks of chunksByBand) {
      if (i < chunks.length) {
        interleavedChunks.push(chunks[i]);
        added = true;
      }
    }
    if (!added) break;
  }

  const scopeChunks = interleavedChunks.slice(0, MAX_ISSUE_QUERIES);

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

  // ─── Phase 3: per-repo cap, then balance across star bands ───
  const allIssues = fetchedPages
    .flatMap((page) => page.issues)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const buckets: SearchIssueResult[][] = STAR_BANDS.map(() => []);
  const seenIssueIds = new Set<string>();
  const perRepoCount = new Map<string, number>();

  for (const issue of allIssues) {
    if (seenIssueIds.has(issue.id)) continue;

    // Doubles as the safety net: repos outside 1k-50k get index -1.
    const band = bandIndex(issue.repository.stars ?? 0);
    if (band === -1) continue;

    const repoKey = makeRepoKey(issue.repository.nameWithOwner);
    const count = perRepoCount.get(repoKey) ?? 0;
    if (count >= MAX_PER_REPO) continue;

    perRepoCount.set(repoKey, count + 1);
    seenIssueIds.add(issue.id);
    buckets[band].push(issue);
  }

  // Round-robin across bands: one from each band in turn, so no size
  // dominates. A band with fewer issues just drops out of the rotation.
  const results: SearchIssueResult[] = [];

  for (let i = 0; results.length < MAX_RESULTS; i++) {
    let added = false;
    for (const bucket of buckets) {
      if (i < bucket.length && results.length < MAX_RESULTS) {
        results.push(bucket[i]);
        added = true;
      }
    }
    if (!added) break;
  }

  console.log(
    `[global] repos/band=${reposByBand.map((n) => n.length).join("/")} ` +
    `queries=${scopeChunks.length} fetched=${allIssues.length} ` +
    `issues/band=${buckets.map((b) => b.length).join("/")} ` +
    `final=${results.length} ` +
    `distinctRepos=${new Set(results.map((i) => i.repository.nameWithOwner)).size}`
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