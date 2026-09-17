const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const GITHUB_REST_URL = "https://api.github.com";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

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
              itemTypes: [CROSS_REFERENCED_EVENT]
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
      variables: { owner, repo },
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

  return repository;
}

// ─────────────────────────────────────────────
// GLOBAL ISSUE SEARCH
//
// One call = up to 100 raw GitHub results.
//
// GitHub performs:
//   - text search
//   - issue search
//   - open-state filtering
//   - no-assignee filtering
//
// We perform:
//   - repository >= 1000 stars (minimum enforced server-side)
//
// This function returns ONLY qualifying issues,
// while preserving GitHub's cursor pagination.
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

  // GitHub handles the issue-side filters.
  // Star filtering is NOT placed here because repository stars are
  // repository metadata, which we already receive below.
  const githubSearchQuery =
    `(${queryText.trim()}) ` +
    `is:issue state:open no:assignee`;

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

  // ─────────────────────────────────────
  // Filter repositories to 1000+ stars
  // ─────────────────────────────────────

  const issues = nodes
    .filter((issue: any) => {
      if (!issue?.repository) return false;

      const stars = issue.repository.stargazerCount ?? 0;
      return stars >= 1000;
    })
    .map((issue: any): SearchIssueResult => {
      const commentsCount = issue.comments?.totalCount ?? 0;
      const isAssigned = (issue.assignees?.nodes?.length ?? 0) > 0;

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
        hasLinkedPr: false,

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
    hasNextPage: searchData?.pageInfo?.hasNextPage ?? false,
    endCursor: searchData?.pageInfo?.endCursor ?? null,
  };
}