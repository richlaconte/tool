export type GlmProviderConfig = {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
}

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type DecisionLogAreaInput = {
  id: string
  text: string
}

export type DecisionLogInput = {
  areas: DecisionLogAreaInput[]
  pageTitle: string
}

type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>

const DEFAULT_GLM_BASE_URL = 'https://api.z.ai/api/paas/v4'
const DEFAULT_GLM_MODEL = 'glm-5.2'
const DEFAULT_GLM_TIMEOUT_MS = 20_000

export const getGlmProviderConfigFromEnv = (
  env: Record<string, string | undefined> = process.env
): GlmProviderConfig | null => {
  const apiKey = (env.GLM_API_KEY ?? env.ZAI_API_KEY ?? '').trim()

  if (!apiKey) return null

  return {
    apiKey,
    baseUrl: trimTrailingSlash(
      env.GLM_BASE_URL ?? env.ZAI_BASE_URL ?? DEFAULT_GLM_BASE_URL
    ),
    model: env.GLM_MODEL ?? DEFAULT_GLM_MODEL,
    timeoutMs: readPositiveInteger(
      env.GLM_TIMEOUT_MS,
      DEFAULT_GLM_TIMEOUT_MS
    ),
  }
}

export const createGlmChatCompletion = async (
  messages: AiChatMessage[],
  config: GlmProviderConfig,
  fetchImpl: FetchLike = fetch
) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetchImpl(
      `${config.baseUrl}/chat/completions`,
      {
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
        }),
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      throw new Error(`GLM request failed with ${response.status}.`)
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: unknown
        }
      }>
    }
    const content = json.choices?.[0]?.message?.content

    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('GLM response did not include message content.')
    }

    return content.trim()
  } finally {
    clearTimeout(timeout)
  }
}

export const createGlmDecisionLogText = (
  input: DecisionLogInput,
  config: GlmProviderConfig,
  fetchImpl?: FetchLike
) =>
  createGlmChatCompletion(
    [
      {
        role: 'system',
        content:
          'You write concise decision logs for a spatial product planning canvas. Return only the decision log text.',
      },
      {
        role: 'user',
        content: [
          `Page: ${input.pageTitle}`,
          '',
          'Areas:',
          ...input.areas.map(
            (area) => `- ${area.id}: ${area.text.slice(0, 1200)}`
          ),
          '',
          'Create a compact decision log with decisions, open questions, and risks. Keep it under 220 words.',
        ].join('\n'),
      },
    ],
    config,
    fetchImpl
  )

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const readPositiveInteger = (
  value: string | undefined,
  fallback: number
) => {
  const parsedValue = Number.parseInt(value ?? '', 10)

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback
}
