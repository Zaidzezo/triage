import OpenAI from "openai"

const MODEL = "deepseek/deepseek-v4-flash-free"

export type Difficulty = "easy" | "medium" | "hard"

export interface ScoreResult {
  difficulty: Difficulty
  explanation: string
}

function getClient(): OpenAI {
  const apiKey = process.env.ORCAROUTER_API_KEY

  if (!apiKey) {
    throw new Error(
      "ORCAROUTER_API_KEY is not set in environment variables"
    )
  }

  return new OpenAI({
    baseURL: "https://api.orcarouter.ai/v1",
    apiKey,
  })
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{")

  if (start === -1) {
    return null
  }

  let depth = 0

  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") {
      depth++
    }

    if (text[i] === "}") {
      depth--
    }

    if (depth === 0) {
      return text.slice(start, i + 1)
    }
  }

  return null
}

function getReasoningContent(
  message: OpenAI.Chat.Completions.ChatCompletionMessage
): string | undefined {
  const value = message as unknown as Record<string, unknown>

  return typeof value.reasoning_content === "string"
    ? value.reasoning_content
    : undefined
}

export async function scoreIssue(
  title: string,
  bodyPreview: string | null
): Promise<ScoreResult> {
  const client = getClient()

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

Do not show your reasoning. Do not think out loud. Respond with ONLY the JSON object below and nothing else — no preamble, no explanation of your reasoning process, no markdown fences:

{
  "difficulty": "easy" | "medium" | "hard",
  "explanation": "2-3 concise sentences"
}
`

  let completion: OpenAI.Chat.Completions.ChatCompletion

  try {
    completion = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.25,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    })
  } catch {
    throw new Error("Model API request failed")
  }

  const message = completion.choices?.[0]?.message

  const text =
    message?.content?.trim() ||
    getReasoningContent(message)?.trim()

  if (!text) {
    throw new Error("Model returned an empty response")
  }

  let parsed: ScoreResult

  try {
    const clean = text.replace(/```json|```/g, "").trim()
    const jsonStr = extractJsonObject(clean) ?? clean

    parsed = JSON.parse(jsonStr) as ScoreResult
  } catch {
    throw new Error("Failed to parse model response")
  }

  if (!["easy", "medium", "hard"].includes(parsed.difficulty)) {
    throw new Error("Model returned an invalid difficulty")
  }

  if (
    typeof parsed.explanation !== "string" ||
    parsed.explanation.trim().length < 20
  ) {
    throw new Error("Model returned an unusable explanation")
  }

  return {
    difficulty: parsed.difficulty,
    explanation: parsed.explanation.trim(),
  }
}