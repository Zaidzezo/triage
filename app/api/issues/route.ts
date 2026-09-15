import { NextRequest, NextResponse } from "next/server";

import { getAccessToken } from "@/app/lib/getAccessToken";
import {
  fetchRepoIssues,
  searchIssues,
  fetchRepositoriesHealth,
} from "@/app/lib/github";
import { prisma } from "@/app/lib/prisma";

function cleanInput(input: string) {
  return input
    .trim()
    .replace(
      /^https?:\/\/github\.com\//i,
      ""
    )
    .replace(
      /^github\.com\//i,
      ""
    )
    .replace(
      /\.git$/i,
      ""
    )
    .replace(
      /\/+$/g,
      ""
    )
    .replace(
      /^Search\s+/i,
      ""
    )
    .trim();
}

function isExactRepository(
  input: string
) {
  return (
    input.includes("/") &&
    input.split("/").length === 2
  );
}

function makeRepoKey(
  fullName: string
) {
  return fullName.toLowerCase();
}

export async function POST(
  req: NextRequest
) {
  // ─────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────

  let accessToken: string;

  try {
    accessToken =
      await getAccessToken();
  } catch {
    return NextResponse.json(
      {
        error:
          "NOT_AUTHENTICATED",
      },
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
      {
        error:
          "Invalid JSON body",
      },
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

  const input =
    cleanInput(rawInput);

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
    const [owner, repoName] =
      input.split("/");

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
          .includes(
            "unauthorized"
          )
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

    const syncTimestamp =
      new Date();

    const dbRepo =
      await prisma.repo.upsert({
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
            repository.primaryLanguage
              ?.name ?? null,

          ownerLogin:
            owner,

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
            repository.primaryLanguage
              ?.name ?? null,

          ownerLogin:
            owner,

          lastSyncedAt:
            syncTimestamp,
        },
      });

    const issues =
      repository.issues?.nodes ??
      [];

    await prisma.$transaction(
      issues.map(
        (issue: any) => {
          const commentsCount =
            issue.comments
              ?.totalCount ?? 0;

          const isAssigned =
            (issue.assignees
              ?.nodes?.length ??
              0) > 0;

          const hasLinkedPr =
            issue.timelineItems
              ?.nodes?.some(
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

          return prisma.issue.upsert({
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

              repoId:
                dbRepo.id,

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
          });
        }
      ),
      {
        timeout: 60_000,
      }
    );

    const dbIssues =
      await prisma.issue.findMany({
        where: {
          repoId:
            dbRepo.id,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 50,

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

          aiScore: {
            select: {
              difficulty: true,
              explanation: true,
            },
          },
        },
      });

    return NextResponse.json({
      mode: "repository",

      search: {
        input: rawInput,
        resolved:
          repository.nameWithOwner,
      },

      repos: [
        {
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
        },
      ],

      issues:
        dbIssues.map(
          (issue) => ({
            ...issue,

            repo: {
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
            },
          })
        ),
    });
  }

  // ─────────────────────────────────────
  // GLOBAL SEARCH MODE
  // ─────────────────────────────────────

  let results;

  try {
    results =
      await searchIssues(
        input,
        accessToken
      );
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

  if (!results.length) {
    return NextResponse.json({
      mode: "global",
      search: {
        input: rawInput,
        resolved: null,
      },
      repos: [],
      issues: [],
    });
  }

  // ─────────────────────────────────────
  // Deduplicate repositories
  // ─────────────────────────────────────

  const repoMap =
    new Map<
      string,
      {
        owner: string;
        name: string;
        fullName: string;
      }
    >();

  for (const issue of results) {
    const fullName =
      issue.repository
        .nameWithOwner;

    if (
      repoMap.size >= 12 &&
      !repoMap.has(
        makeRepoKey(
          fullName
        )
      )
    ) {
      continue;
    }

    const [owner, name] =
      fullName.split("/");

    repoMap.set(
      makeRepoKey(fullName),
      {
        owner,
        name,
        fullName,
      }
    );
  }

  // ─────────────────────────────────────
  // Calculate repository health
  // ─────────────────────────────────────

  let healthMap: Record<
    string,
    any
  > = {};

  try {
    healthMap =
      await fetchRepositoriesHealth(
        [...repoMap.values()].map(
          (repo) => ({
            owner:
              repo.owner,
            name:
              repo.name,
          })
        ),
        accessToken
      );
  } catch (error) {
    console.error(
      "Repository health calculation failed:",
      error
    );
  }

  // ─────────────────────────────────────
  // Cache issues in database
  // ─────────────────────────────────────

  const syncTimestamp =
    new Date();

  const databaseIssueIds =
    new Map<
      string,
      string
    >();

  for (const issue of results) {
    try {
      const [owner] =
        issue.repository
          .nameWithOwner
          .split("/");

      const repoName =
        issue.repository
          .nameWithOwner
          .split("/")[1];

      const dbRepo =
        await prisma.repo.upsert({
          where: {
            githubRepoId:
              issue.repository.id,
          },

          update: {
            fullName:
              issue.repository
                .nameWithOwner,

            description:
              issue.repository
                .description,

            stars:
              issue.repository
                .stars,

            language:
              issue.repository
                .language,

            ownerLogin:
              owner,

            lastSyncedAt:
              syncTimestamp,
          },

          create: {
            githubRepoId:
              issue.repository.id,

            fullName:
              issue.repository
                .nameWithOwner,

            description:
              issue.repository
                .description,

            stars:
              issue.repository
                .stars,

            language:
              issue.repository
                .language,

            ownerLogin:
              owner,

            lastSyncedAt:
              syncTimestamp,
          },
        });

      const bodyPreview =
        issue.body
          ? issue.body.slice(
              0,
              700
            )
          : null;

      const dbIssue =
        await prisma.issue.upsert({
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
        });

      databaseIssueIds.set(
        issue.id,
        dbIssue.id
      );

      void repoName;
    } catch (error) {
      console.error(
        "Failed caching issue:",
        error
      );
    }
  }

  // ─────────────────────────────────────
  // Final response
  // ─────────────────────────────────────

  const finalIssues =
    results.map((issue) => {
      const fullName =
        issue.repository
          .nameWithOwner;

      return {
        id:
          databaseIssueIds.get(
            issue.id
          ) ?? issue.id,

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
            issue.repository
              .stars,

          language:
            issue.repository
              .language,

          description:
            issue.repository
              .description,

          health:
            healthMap[
              fullName
            ] ?? {
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

  const repoSummary =
    [...repoMap.values()].map(
      (repo) => {
        const matchingIssue =
          results.find(
            (issue) =>
              issue.repository
                .nameWithOwner
                .toLowerCase() ===
              repo.fullName.toLowerCase()
          );

        return {
          fullName:
            repo.fullName,

          stars:
            matchingIssue
              ?.repository
              .stars ?? 0,

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
            ] ?? {
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

  return NextResponse.json({
    mode: "global",

    search: {
      input: rawInput,
      resolved: null,
    },

    repos:
      repoSummary,

    issues:
      finalIssues,
  });
}