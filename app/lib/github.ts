const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

const GITHUB_REST_URL = "https://api.github.com";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface RepositoryHealth {
  reviewedInLast10: boolean;
  pullRequestsChecked: number;
  reviewedPullRequests: number;
}

export interface SearchRepository {
  id: string;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  owner: {
    login: string;
  };
}

export interface SearchIssueResult {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  url: string;
  createdAt: string;
  authorAssociation: string;
  commentsCount: number;
  isAssigned: boolean;
  hasLinkedPr: boolean;

  repository: {
    id: string;
    nameWithOwner: string;
    description: string | null;
    stars: number;
    language: string | null;
    ownerLogin: string;
  };
}

export interface SearchIssuesPage {
  issues: SearchIssueResult[];
  hasNextPage: boolean;
  endCursor: string | null;
}

// ─────────────────────────────────────────────
// SEARCH REPOSITORIES
// Used when you want repository suggestions/fallbacks
// ─────────────────────────────────────────────

export async function searchRepositories(
  query: string,
  accessToken: string
): Promise<SearchRepository[]> {
  const q = `${query} in:name,description,readme archived:false fork:false`;

  const url =
    `${GITHUB_REST_URL}/search/repositories?` +
    new URLSearchParams({
      q,
      per_page: "10",
      sort: "stars",
      order: "desc",
    });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `GitHub repository search error ${response.status}: ${errorText}`
    );
  }

  const data = await response.json();

  return Array.isArray(data.items) ? data.items : [];
}

// ─────────────────────────────────────────────
// EXACT REPOSITORY ISSUE FETCH
// Used for:
// vercel/next.js
// facebook/react
// microsoft/vscode
// ─────────────────────────────────────────────

export async function fetchRepoIssues(
  owner: string,
  repo: string,
  accessToken: string
) {
  const query = `
    query GetRepoIssues(
      $owner: String!
      $repo: String!
    ) {
      repository(
        owner: $owner
        name: $repo
      ) {
        id
        nameWithOwner
        description
        stargazerCount

        primaryLanguage {
          name
        }

        issues(
          first: 100
          states: [OPEN]
          orderBy: {
            field: CREATED_AT
            direction: DESC
          }
        ) {
          pageInfo {
            hasNextPage
            endCursor
          }

          nodes {
            id
            number
            title
            body
            state
            url
            createdAt
            authorAssociation

            comments {
              totalCount
            }

            assignees(first: 1) {
              nodes {
                login
              }
            }

            timelineItems(
              first: 10
              itemTypes: [
                CROSS_REFERENCED_EVENT
              ]
            ) {
              nodes {
                ... on CrossReferencedEvent {
                  willCloseTarget

                  source {
                    ... on PullRequest {
                      id
                      state
                    }
                  }
                }
              }
            }
          }
        }

        pullRequests(
          first: 10
          states: [
            OPEN
            CLOSED
            MERGED
          ]
          orderBy: {
            field: CREATED_AT
            direction: DESC
          }
        ) {
          nodes {
            reviews(first: 1) {
              totalCount
            }
          }
        }
      }
    }
  `;

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      query,
      variables: {
        owner,
        repo,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.errors?.length) {
    throw new Error(data.errors[0]?.message ?? "GitHub GraphQL error");
  }

  const repository = data.data?.repository;

  if (!repository) {
    throw new Error("Repository not found");
  }

  // ─────────────────────────────────────────────
  // REPOSITORY HEALTH
  // Healthy = at least one of latest 10 PRs
  // has at least one review.
  // ─────────────────────────────────────────────

  const pullRequests = repository.pullRequests?.nodes ?? [];

  const reviewedPullRequests = pullRequests.filter(
    (pullRequest: any) => (pullRequest.reviews?.totalCount ?? 0) > 0
  ).length;

  return {
    ...repository,

    health: {
      reviewedInLast10: reviewedPullRequests > 0,

      pullRequestsChecked: pullRequests.length,

      reviewedPullRequests,
    } satisfies RepositoryHealth,
  };
}

// ─────────────────────────────────────────────
// GLOBAL ISSUE SEARCH
//
// Examples:
// book
// songs
// programming
// react
// school
//
// Searches across multiple repositories.
// Supports cursor pagination so the caller can
// page through GitHub's top 1000 results.
// ─────────────────────────────────────────────

export async function searchIssues(
  queryText: string,
  accessToken: string,
  cursor?: string
): Promise<SearchIssuesPage> {
  const query = `
    query SearchIssues(
      $query: String!
      $cursor: String
    ) {
      search(
        query: $query
        type: ISSUE
        first: 100
        after: $cursor
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }

        nodes {
          ... on Issue {
            id
            number
            title
            body
            state
            url
            createdAt
            authorAssociation

            comments {
              totalCount
            }

            assignees(first: 1) {
              nodes {
                login
              }
            }

            repository {
              id
              nameWithOwner
              description
              stargazerCount

              primaryLanguage {
                name
              }

              owner {
                login
              }
            }
          }
        }
      }
    }
  `;

  const githubSearchQuery =
    `(${queryText.trim()}) ` + `is:issue state:open`;

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      query,
      variables: {
        query: githubSearchQuery,
        cursor: cursor ?? null,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub search error: ${response.status}`);
  }

  const data = await response.json();

  if (data.errors?.length) {
    throw new Error(data.errors[0]?.message ?? "GitHub issue search failed");
  }

  const searchData = data.data?.search;

  const nodes = searchData?.nodes ?? [];

  const pageInfo = searchData?.pageInfo ?? {
    hasNextPage: false,
    endCursor: null,
  };

  const issues = nodes
    .filter((issue: any) => issue?.repository)
    .map((issue: any): SearchIssueResult => {
      const commentsCount = issue.comments?.totalCount ?? 0;

      const isAssigned = (issue.assignees?.nodes?.length ?? 0) > 0;

      const hasLinkedPr = false;

      return {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body ? issue.body.slice(0, 700) : null,
        state: issue.state,
        url: issue.url,
        createdAt: issue.createdAt,
        authorAssociation: issue.authorAssociation,
        commentsCount,
        isAssigned,
        hasLinkedPr,
        repository: {
          id: issue.repository.id,
          nameWithOwner: issue.repository.nameWithOwner,
          description: issue.repository.description,
          stars: issue.repository.stargazerCount,
          language: issue.repository.primaryLanguage?.name ?? null,
          ownerLogin: issue.repository.owner?.login ?? "",
        },
      };
    });

  return {
    issues,
    hasNextPage: pageInfo.hasNextPage,
    endCursor: pageInfo.endCursor,
  };
}

// ─────────────────────────────────────────────
// BATCH REPOSITORY HEALTH
//
// Checks latest 10 PRs for each repository.
// ─────────────────────────────────────────────

export async function fetchRepositoriesHealth(
  repositories: {
    owner: string;
    name: string;
  }[],
  accessToken: string
): Promise<Record<string, RepositoryHealth>> {
  // We limit this because each repository
  // requires PR/review information.
  const limitedRepositories = repositories.slice(0, 12);

  if (limitedRepositories.length === 0) {
    return {};
  }

  const variables: Record<string, string> = {};

  const repositorySelections = limitedRepositories
    .map((repository, index) => {
      const ownerVariable = `owner${index}`;

      const nameVariable = `name${index}`;

      variables[ownerVariable] = repository.owner;

      variables[nameVariable] = repository.name;

      return `
            repo${index}: repository(
              owner: $${ownerVariable}
              name: $${nameVariable}
            ) {
              nameWithOwner

              pullRequests(
                first: 10
                states: [
                  OPEN
                  CLOSED
                  MERGED
                ]
                orderBy: {
                  field: CREATED_AT
                  direction: DESC
                }
              ) {
                nodes {
                  reviews(first: 1) {
                    totalCount
                  }
                }
              }
            }
          `;
    })
    .join("\n");

  const variableDefinitions = limitedRepositories
    .map((_, index) => `$owner${index}: String!, $name${index}: String!`)
    .join(", ");

  const query = `
    query RepositoryHealth(
      ${variableDefinitions}
    ) {
      ${repositorySelections}
    }
  `;

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub health API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.errors?.length) {
    throw new Error(
      data.errors[0]?.message ?? "Failed to calculate repository health"
    );
  }

  const result: Record<string, RepositoryHealth> = {};

  limitedRepositories.forEach((repository, index) => {
    const githubRepository = data.data?.[`repo${index}`];

    const pullRequests = githubRepository?.pullRequests?.nodes ?? [];

    const reviewedPullRequests = pullRequests.filter(
      (pullRequest: any) => (pullRequest.reviews?.totalCount ?? 0) > 0
    ).length;

    result[`${repository.owner}/${repository.name}`] = {
      reviewedInLast10: reviewedPullRequests > 0,

      pullRequestsChecked: pullRequests.length,

      reviewedPullRequests,
    };
  });

  return result;
}