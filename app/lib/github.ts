export async function fetchRepoIssues(
  owner: string,
  repo: string,
  accessToken: string
) {
  const query = `
    query GetRepoIssues($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        id
        nameWithOwner
        description
        stargazerCount
        primaryLanguage { name }
        issues(
          first: 100
          states: [OPEN]
          orderBy: { field: CREATED_AT, direction: DESC }
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
            comments { totalCount }
            assignees(first: 1) { nodes { login } }
            timelineItems(first: 3, itemTypes: [CROSS_REFERENCED_EVENT]) {
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
  `

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { owner, repo },
    }),
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const data = await response.json()

  if (data.errors) {
    throw new Error(data.errors[0].message)
  }

  return data.data.repository
}