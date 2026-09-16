import { NextRequest, NextResponse } from "next/server";

import { getAccessToken } from "@/app/lib/getAccessToken";
import {
  fetchRepoIssues,
  searchIssues,
  fetchRepositoriesHealth,
  type SearchIssueResult,
} from "@/app/lib/github";
import { prisma } from "@/app/lib/prisma";

// ─────────────────────────────────────
// SEARCH LIMITS
// ─────────────────────────────────────

const MAX_RESULTS = 200;
const GITHUB_PAGE_SIZE = 100;

// GitHub search is paginated with cursors.
// This allows us to inspect up to 1000 raw
// search results in one request if necessary
// to find 200 qualifying issues.
const MAX_GITHUB_PAGES = 10;

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
  return (
    input.includes("/") &&
    input.split("/").length === 2
  );
}

function makeRepoKey(fullName: string) {
  return fullName.toLowerCase();
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

  const rawInput =
    body.repo?.trim() ?? "";

  if (!rawInput) {
    return NextResponse.json(
      {
        error:
          "Search query is required",
      },
      { status: 400 }
    );
  }

  const input = cleanInput(rawInput);

  if (!input) {
    return NextResponse.json(
      {
        error:
          "Search query is empty",
      },
      { status: 400 }
    );
  }

  // ─────────────────────────────────────
  // EXACT REPOSITORY MODE
  // ─────────────────────────────────────

  if (isExactRepository(input)) {
    const [
      owner,
      repoName,
    ] = input.split("/");

    let repository: any;

    try {
      repository =
        await fetchRepoIssues(
          owner,
          repoName,
          accessToken
        );
    } catch (error: any) {
      const message =
        error?.message ?? "";

      if (
        message.includes("401") ||
        message
          .toLowerCase()
          .includes("unauthorized")
      ) {
        return NextResponse.json(
          {
            error:
              "TOKEN_REVOKED",
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          error:
            message ||
            "Failed to fetch repository",
        },
        { status: 500 }
      );
    }

    if (!repository) {
      return NextResponse.json(
        {
          error:
            "Repository not found",
        },
        { status: 404 }
      );
    }

    // Only repositories with 1000+
    // stars are allowed.
    if (
      repository.stargazerCount <
      1000
    ) {
      return NextResponse.json({
        mode: "repository",
        search: {
          input: rawInput,
          resolved:
            repository.nameWithOwner,
        },
        repos: [],
        issues: [],
        pagination: {
          hasNextPage: false,
          endCursor: null,
        },
      });
    }

    const syncTimestamp =
      new Date();

    // Only unassigned issues.
    const repositoryIssues =
      (
        repository.issues?.nodes ??
        []
      ).filter(
        (issue: any) =>
          (issue.assignees?.nodes
            ?.length ?? 0) === 0
      );

    // ─────────────────────────────────────
    // Background database cache
    // ─────────────────────────────────────

    void (async () => {
      try {
        const dbRepo =
          await prisma.repo.upsert(
            {
              where: {
                githubRepoId:
                  repository.id,
              },

              update: {
                fullName:
                  repository.nameWithOwner,
                description:
                  repository.description,
                stars:
                  repository.stargazerCount,
                language:
                  repository
                    .primaryLanguage
                    ?.name ?? null,
                ownerLogin: owner,
                lastSyncedAt:
                  syncTimestamp,
              },

              create: {
                githubRepoId:
                  repository.id,
                fullName:
                  repository.nameWithOwner,
                description:
                  repository.description,
                stars:
                  repository.stargazerCount,
                language:
                  repository
                    .primaryLanguage
                    ?.name ?? null,
                ownerLogin: owner,
                lastSyncedAt:
                  syncTimestamp,
              },
            }
          );

        await prisma.$transaction(
          repositoryIssues.map(
            (issue: any) => {
              const commentsCount =
                issue.comments
                  ?.totalCount ?? 0;

              const isAssigned =
                (
                  issue.assignees
                    ?.nodes?.length ??
                  0
                ) > 0;

              const hasLinkedPr =
                issue.timelineItems?.nodes?.some(
                  (node: any) =>
                    node?.willCloseTarget &&
                    node?.source?.id
                ) ?? false;

              const bodyPreview =
                issue.body
                  ? issue.body.slice(
                      0,
                      700
                    )
                  : null;

              return prisma.issue.upsert(
                {
                  where: {
                    githubIssueId:
                      issue.id,
                  },

                  update: {
                    title:
                      issue.title,
                    number:
                      issue.number,
                    url: issue.url,
                    bodyPreview,
                    state:
                      issue.state,
                    authorAssociation:
                      issue.authorAssociation,
                    commentsCount,
                    isAssigned,
                    hasLinkedPr,
                    lastSyncedAt:
                      syncTimestamp,
                  },

                  create: {
                    githubIssueId:
                      issue.id,
                    repoId: dbRepo.id,
                    title:
                      issue.title,
                    number:
                      issue.number,
                    url: issue.url,
                    bodyPreview,
                    state:
                      issue.state,
                    authorAssociation:
                      issue.authorAssociation,
                    commentsCount,
                    isAssigned,
                    hasLinkedPr,
                    createdAt:
                      new Date(
                        issue.createdAt
                      ),
                    lastSyncedAt:
                      syncTimestamp,
                  },
                }
              );
            }
          ),
          {
            timeout: 60_000,
          }
        );
      } catch (error) {
        console.error(
          "Failed caching repo issues:",
          error
        );
      }
    })();

    const repoMeta = {
      fullName:
        repository.nameWithOwner,
      stars:
        repository.stargazerCount,
      language:
        repository.primaryLanguage
          ?.name ?? null,
      description:
        repository.description,
      health:
        repository.health,
    };

    return NextResponse.json({
      mode: "repository",

      search: {
        input: rawInput,
        resolved:
          repository.nameWithOwner,
      },

      repos: [repoMeta],

      issues: repositoryIssues
        .slice(0, MAX_RESULTS)
        .map((issue: any) => {
          const commentsCount =
            issue.comments
              ?.totalCount ?? 0;

          const isAssigned =
            (
              issue.assignees
                ?.nodes?.length ?? 0
            ) > 0;

          const hasLinkedPr =
            issue.timelineItems?.nodes?.some(
              (node: any) =>
                node?.willCloseTarget &&
                node?.source?.id
            ) ?? false;

          return {
            id: issue.id,
            githubIssueId:
              issue.id,
            number:
              issue.number,
            title:
              issue.title,
            url:
              issue.url,
            bodyPreview:
              issue.body
                ? issue.body.slice(
                    0,
                    700
                  )
                : null,
            state:
              issue.state,
            authorAssociation:
              issue.authorAssociation,
            commentsCount,
            isAssigned,
            hasLinkedPr,
            createdAt:
              issue.createdAt,
            aiScore: null,
            repo: repoMeta,
          };
        }),

      pagination: {
        hasNextPage:
          repositoryIssues.length >
          MAX_RESULTS,
        endCursor: null,
      },
    });
  }

  // ─────────────────────────────────────
  // GLOBAL SEARCH MODE
  //
  // We fetch GitHub pages of 100 raw
  // search results and continue until:
  //
  //   1. We collect 200 qualifying issues
  //   OR
  //   2. GitHub has no more results
  //   OR
  //   3. We reach the safety limit
  //
  // Qualifying issue:
  //
  //   - open
  //   - unassigned
  //   - repository >= 1000 stars
  //
  // The frontend then displays these 200
  // locally at 30 issues per page.
  // ─────────────────────────────────────

  let results: SearchIssueResult[] =
    [];

  let githubHasNextPage = true;
  let githubCursor:
    | string
    | undefined;

  const seenIssueIds =
    new Set<string>();

  try {
    for (
      let page = 0;
      page < MAX_GITHUB_PAGES;
      page++
    ) {
      if (
        !githubHasNextPage ||
        results.length >=
          MAX_RESULTS
      ) {
        break;
      }

      const githubResult =
        await searchIssues(
          input,
          accessToken,
          githubCursor
        );

      for (
        const issue of githubResult.issues
      ) {
        if (
          seenIssueIds.has(
            issue.id
          )
        ) {
          continue;
        }

        seenIssueIds.add(
          issue.id
        );

        results.push(issue);

        if (
          results.length >=
          MAX_RESULTS
        ) {
          break;
        }
      }

      githubHasNextPage =
        githubResult.hasNextPage;

      githubCursor =
        githubResult.endCursor ??
        undefined;

      if (
        !githubCursor
      ) {
        break;
      }
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ??
          "GitHub issue search failed",
      },
      { status: 500 }
    );
  }

  // Hard cap.
  results = results.slice(
    0,
    MAX_RESULTS
  );

  // ─────────────────────────────────────
  // No results
  // ─────────────────────────────────────

  if (!results.length) {
    return NextResponse.json({
      mode: "global",

      search: {
        input: rawInput,
        resolved: null,
      },

      repos: [],
      issues: [],

      pagination: {
        hasNextPage: false,
        endCursor: null,
      },
    });
  }

  // ─────────────────────────────────────
  // Deduplicate repositories
  // ─────────────────────────────────────

  const repoMap = new Map<
    string,
    {
      owner: string;
      name: string;
      fullName: string;
    }
  >();

  for (
    const issue of results
  ) {
    const fullName =
      issue.repository
        .nameWithOwner;

    const key =
      makeRepoKey(fullName);

    if (
      repoMap.has(key)
    ) {
      continue;
    }

    if (
      repoMap.size >= 12
    ) {
      continue;
    }

    const [
      owner,
      name,
    ] = fullName.split("/");

    repoMap.set(
      key,
      {
        owner,
        name,
        fullName,
      }
    );
  }

  const syncTimestamp =
    new Date();

  // ─────────────────────────────────────
  // Repository health
  // ─────────────────────────────────────

  const healthPromise =
    fetchRepositoriesHealth(
      [...repoMap.values()].map(
        (repo) => ({
          owner:
            repo.owner,
          name:
            repo.name,
        })
      ),
      accessToken
    ).catch((error) => {
      console.error(
        "Repository health calculation failed:",
        error
      );

      return {} as Record<
        string,
        any
      >;
    });

  // ─────────────────────────────────────
  // Background database cache
  // ─────────────────────────────────────

  void (async () => {
    const CHUNK = 10;

    for (
      let i = 0;
      i < results.length;
      i += CHUNK
    ) {
      await Promise.all(
        results
          .slice(
            i,
            i + CHUNK
          )
          .map(
            async (issue) => {
              try {
                const [
                  owner,
                ] =
                  issue.repository.nameWithOwner.split(
                    "/"
                  );

                const dbRepo =
                  await prisma.repo.upsert(
                    {
                      where: {
                        githubRepoId:
                          issue
                            .repository
                            .id,
                      },

                      update: {
                        fullName:
                          issue
                            .repository
                            .nameWithOwner,
                        description:
                          issue
                            .repository
                            .description,
                        stars:
                          issue
                            .repository
                            .stars,
                        language:
                          issue
                            .repository
                            .language,
                        ownerLogin:
                          owner,
                        lastSyncedAt:
                          syncTimestamp,
                      },

                      create: {
                        githubRepoId:
                          issue
                            .repository
                            .id,
                        fullName:
                          issue
                            .repository
                            .nameWithOwner,
                        description:
                          issue
                            .repository
                            .description,
                        stars:
                          issue
                            .repository
                            .stars,
                        language:
                          issue
                            .repository
                            .language,
                        ownerLogin:
                          owner,
                        lastSyncedAt:
                          syncTimestamp,
                      },
                    }
                  );

                const bodyPreview =
                  issue.body
                    ? issue.body.slice(
                        0,
                        700
                      )
                    : null;

                await prisma.issue.upsert(
                  {
                    where: {
                      githubIssueId:
                        issue.id,
                    },

                    update: {
                      title:
                        issue.title,
                      number:
                        issue.number,
                      url:
                        issue.url,
                      bodyPreview,
                      state:
                        issue.state,
                      authorAssociation:
                        issue.authorAssociation,
                      commentsCount:
                        issue.commentsCount,
                      isAssigned:
                        issue.isAssigned,
                      hasLinkedPr:
                        issue.hasLinkedPr,
                      lastSyncedAt:
                        syncTimestamp,
                    },

                    create: {
                      githubIssueId:
                        issue.id,
                      repoId:
                        dbRepo.id,
                      title:
                        issue.title,
                      number:
                        issue.number,
                      url:
                        issue.url,
                      bodyPreview,
                      state:
                        issue.state,
                      authorAssociation:
                        issue.authorAssociation,
                      commentsCount:
                        issue.commentsCount,
                      isAssigned:
                        issue.isAssigned,
                      hasLinkedPr:
                        issue.hasLinkedPr,
                      createdAt:
                        new Date(
                          issue.createdAt
                        ),
                      lastSyncedAt:
                        syncTimestamp,
                    },
                  }
                );
              } catch (error) {
                console.error(
                  "Failed caching issue:",
                  error
                );
              }
            }
          )
      );
    }
  })();

  // ─────────────────────────────────────
  // Health
  //
  // We still calculate it before returning
  // because your existing UI expects it.
  // ─────────────────────────────────────

  const healthMap =
    await healthPromise;

  // ─────────────────────────────────────
  // Final issues
  // ─────────────────────────────────────

  const finalIssues =
    results.map((issue) => {
      const fullName =
        issue.repository
          .nameWithOwner;

      return {
        id: issue.id,
        githubIssueId:
          issue.id,
        number:
          issue.number,
        title:
          issue.title,
        url:
          issue.url,
        bodyPreview:
          issue.body,
        state:
          issue.state,
        authorAssociation:
          issue.authorAssociation,
        commentsCount:
          issue.commentsCount,
        isAssigned:
          issue.isAssigned,
        hasLinkedPr:
          issue.hasLinkedPr,
        createdAt:
          issue.createdAt,
        aiScore: null,

        repo: {
          fullName,

          stars:
            issue
              .repository
              .stars,

          language:
            issue
              .repository
              .language,

          description:
            issue
              .repository
              .description,

          health:
            healthMap[fullName] ??
            {
              reviewedInLast10:
                false,
              pullRequestsChecked:
                0,
              reviewedPullRequests:
                0,
            },
        },
      };
    });

  // ─────────────────────────────────────
  // Repository summaries
  // ─────────────────────────────────────

  const repoSummary =
    [...repoMap.values()].map(
      (repo) => {
        const matchingIssue =
          results.find(
            (issue) =>
              issue
                .repository
                .nameWithOwner
                .toLowerCase() ===
              repo.fullName.toLowerCase()
          );

        return {
          fullName:
            repo.fullName,

          stars:
            matchingIssue
              ?.repository.stars ??
            0,

          language:
            matchingIssue
              ?.repository
              .language ??
            null,

          description:
            matchingIssue
              ?.repository
              .description ??
            null,

          health:
            healthMap[
              repo.fullName
            ] ??
            {
              reviewedInLast10:
                false,
              pullRequestsChecked:
                0,
              reviewedPullRequests:
                0,
            },
        };
      }
    );

  // ─────────────────────────────────────
  // Final response
  // ─────────────────────────────────────

  return NextResponse.json({
    mode: "global",

    search: {
      input: rawInput,
      resolved: null,
    },

    repos: repoSummary,

    issues: finalIssues,

    // This is informational only.
    // Your HomeContent should continue doing
    // local 30-item pagination over the returned
    // 200-item pool.
    pagination: {
      hasNextPage:
        githubHasNextPage,
      endCursor:
        githubCursor ?? null,
    },
  });
}