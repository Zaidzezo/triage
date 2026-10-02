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

export interface RepoMetadata {
  id: string;
  nameWithOwner: string;
  description: string | null;
  stars: number;
  language: string | null;
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
  totalCount: number;
}

// ─────────────────────────────────────────────
// SHARED HEADERS
// ─────────────────────────────────────────────

function restHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// ─────────────────────────────────────────────
// SEARCH REPOSITORIES
// ─────────────────────────────────────────────

export async function searchRepositories(
  query: string,
  accessToken: string,
  opts?: { minStars?: number; perPage?: number }
): Promise<SearchRepository[]> {
  const minStars = opts?.minStars ?? 1000;
  const perPage = opts?.perPage ?? 10;

  const q = `${query} in:name,description,readme stars:>${minStars} archived:false fork:false`;

  const url =
    `${GITHUB_REST_URL}/search/repositories?` +
    new URLSearchParams({
      q,
      per_page: String(perPage),
      sort: "stars",
      order: "desc",
    });

  const response = await fetch(url, {
    headers: restHeaders(accessToken),
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
// EXACT REPOSITORY METADATA (REST)
//
// Lightweight lookup used to:
//   - distinguish 404 from empty results
//   - enforce the 1000-star minimum
//   - get repo description/language even when
//     the repo has zero matching issues
// ─────────────────────────────────────────────

export async function fetchRepoMetadata(
  owner: string,
  repo: string,
  accessToken: string
): Promise<RepoMetadata> {
  const url = `${GITHUB_REST_URL}/repos/${owner}/${repo}`;

  const response = await fetch(url, {
    headers: restHeaders(accessToken),
  });

  if (response.status === 404) {
    throw new Error("Repository not found");
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    id: String(data.id),
    nameWithOwner: data.full_name,
    description: data.description ?? null,
    stars: data.stargazers_count ?? 0,
    language: data.language ?? null,
  };
}

// ─────────────────────────────────────────────
// GLOBAL / PER-REPO ISSUE SEARCH
//
// GitHub performs server-side:
//   - text search
//   - is:issue filter
//   - open-state filter
//   - no-assignee filter
//   - created:>date filter (last 6 months)
//   - stars:>1000 filter
//
// One call = up to 50 raw results, cursor
// paginated. Callers loop to reach their cap.
// ─────────────────────────────────────────────

export interface SearchIssuesOptions {
  minStars?: number;
  unassignedOnly?: boolean;
  maxAgeMonths?: number;
  repoScope?: string[];
}

export async function searchIssues(
  queryText: string,
  accessToken: string,
  cursor?: string,
  opts?: SearchIssuesOptions
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
        issueCount

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

            repository {
              id
              nameWithOwner
              description
              stargazerCount

              primaryLanguage {
                name
              }
            }
          }
        }
      }
    }
  `;

  // ─────────────────────────────────────
  // Filter knobs — defaults match prior
  // hardcoded behavior exactly.
  // ─────────────────────────────────────

  const minStars = opts?.minStars ?? 1000;
  const unassignedOnly = opts?.unassignedOnly ?? true;
  const maxAgeMonths = opts?.maxAgeMonths ?? 6;

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - maxAgeMonths);
  const dateStr = cutoffDate.toISOString().split("T")[0];

  const githubSearchQuery =
    `${queryText.trim()} ` +
  `is:issue is:open ` +
  `${unassignedOnly ? "no:assignee " : ""}` +
  `stars:>${minStars} created:>${dateStr} sort:created-desc`;

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { query: githubSearchQuery, cursor: cursor ?? null },
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

  const issues = nodes
    .filter((issue: any) => issue?.repository)
    .map((issue: any): SearchIssueResult => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body ?? null,
      state: issue.state,
      url: issue.url,
      createdAt: issue.createdAt,
      authorAssociation: issue.authorAssociation,
      commentsCount: issue.comments?.totalCount ?? 0,
      isAssigned: false,
      hasLinkedPr: false,
      repository: {
        id: issue.repository.id,
        nameWithOwner: issue.repository.nameWithOwner,
        description: issue.repository.description,
        stars: issue.repository.stargazerCount,
        language: issue.repository.primaryLanguage?.name ?? null,
        ownerLogin: issue.repository.nameWithOwner.split("/")[0],
      },
    }));

  console.log(
    `[searchIssues] q="${githubSearchQuery}" raw=${nodes.length} ` +
    `kept=${issues.length} totalCount=${searchData?.issueCount ?? 0} ` +
    `hasNextPage=${searchData?.pageInfo?.hasNextPage ?? false}`
  );

  return {
    issues,
    hasNextPage: searchData?.pageInfo?.hasNextPage ?? false,
    endCursor: searchData?.pageInfo?.endCursor ?? null,
    totalCount: searchData?.issueCount ?? 0,
  };
}