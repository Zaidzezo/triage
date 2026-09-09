const BAI_API_URL = "https://api.b.ai/v1/chat/completions"
const MODEL = "glm-5.3-flash"

export type Difficulty = "easy" | "medium" | "hard"

export interface ScoreResult {
  difficulty: Difficulty
  explanation: string
}

export async function scoreIssue(
  title: string,
  bodyPreview: string | null
): Promise<ScoreResult> {
  const apiKey = process.env.BAI_API_KEY
  if (!apiKey) {
    throw new Error("BAI_API_KEY is not set in environment variables")
  }

  const prompt = `You are a senior software engineer evaluating a GitHub issue to help contributors decide if they can tackle it.

Analyze this issue and determine its difficulty level.

Issue title: ${title}
Issue description: ${bodyPreview ?? "No description provided."}

Respond with a JSON object only, no markdown, no explanation outside the JSON:
{
  "difficulty": "easy" | "medium" | "hard",
  "explanation": "1-2 sentences explaining why"
}`

  let response: Response
  try {
    response = await fetch(BAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })
  } catch (err) {
    throw new Error(`Network error calling GLM API: ${err}`)
  }

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`GLM API error ${response.status}: ${errorBody}`)
  }

  const data = await response.json()

  const message = data.choices?.[0]?.message
    const text = message?.content?.trim() || message?.reasoning_content?.trim()

    if (!text) {
    throw new Error(`Empty response from GLM: ${JSON.stringify(data)}`)
    }

  let parsed: ScoreResult
  try {
    const clean = text.replace(/```json|```/g, "").trim()
    parsed = JSON.parse(clean)
  } catch {
    throw new Error(`Failed to parse GLM response: ${text}`)
  }

  if (!["easy", "medium", "hard"].includes(parsed.difficulty)) {
    throw new Error(`Invalid difficulty value: ${parsed.difficulty}`)
  }

  return parsed
}