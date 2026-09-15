const BAI_API_URL =
  "https://api.b.ai/v1/chat/completions";

const MODEL = "qwen3.8-flash";

export type Difficulty =
  | "easy"
  | "medium"
  | "hard";

export interface ScoreResult {
  difficulty: Difficulty;
  explanation: string;
}

export async function scoreIssue(
  title: string,
  bodyPreview: string | null
): Promise<ScoreResult> {
  const apiKey =
    process.env.BAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "BAI_API_KEY is not set in environment variables"
    );
  }

  const prompt = `
You are a senior open-source maintainer evaluating a GitHub issue for a developer who wants to contribute to the project.

Your job is to estimate how difficult the issue is for a reasonably competent developer who is unfamiliar with the repository.

Issue title:
${title}

Issue description:
${bodyPreview ?? "No description provided."}

Classify the issue as exactly one of:

- easy: small, localized, well-defined work with limited repository knowledge
- medium: requires understanding multiple parts of the codebase, debugging, or some design decisions
- hard: broad architectural work, deep debugging, complex behavior, or significant repository knowledge

Then write a useful explanation.

The explanation MUST:
1. Be 2-3 sentences.
2. Explain what makes the issue easy, medium, or hard.
3. Mention the likely technical work involved when it can reasonably be inferred.
4. Explain what a contributor should understand before starting.
5. Never invent implementation details that are not supported by the issue.

Return ONLY valid JSON:

{
  "difficulty": "easy" | "medium" | "hard",
  "explanation": "2-3 concise sentences"
}
`;

  let response: Response;

  try {
    response = await fetch(
      BAI_API_URL,
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          model: MODEL,

          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],

          temperature: 0.25,
          max_tokens: 500,
        }),
      }
    );
  } catch (error) {
    throw new Error(
      `Network error calling model API: ${error}`
    );
  }

  if (!response.ok) {
    const errorBody =
      await response.text();

    throw new Error(
      `model API error ${response.status}: ${errorBody}`
    );
  }

  const data =
    await response.json();

  const message =
    data.choices?.[0]?.message;

  const text =
    message?.content?.trim() ||
    message?.reasoning_content?.trim();

  if (!text) {
    throw new Error(
      `Empty response from model: ${JSON.stringify(
        data
      )}`
    );
  }

  let parsed: ScoreResult;

  try {
    const clean = text
      .replace(/```json|```/g, "")
      .trim();

    parsed = JSON.parse(clean);
  } catch {
    throw new Error(
      `Failed to parse model response: ${text}`
    );
  }

  if (
    ![
      "easy",
      "medium",
      "hard",
    ].includes(parsed.difficulty)
  ) {
    throw new Error(
      `Invalid difficulty value: ${parsed.difficulty}`
    );
  }

  if (
    typeof parsed.explanation !==
      "string" ||
    parsed.explanation
      .trim()
      .length < 20
  ) {
    throw new Error(
      "Model returned an unusable explanation"
    );
  }

  return {
    difficulty:
      parsed.difficulty,
    explanation:
      parsed.explanation.trim(),
  };
}