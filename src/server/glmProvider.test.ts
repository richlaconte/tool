import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createGlmChatCompletion,
  createGlmDecisionLogText,
  getGlmProviderConfigFromEnv,
} from './glmProvider.ts'

test('GLM provider config reads Z.AI compatible environment variables', () => {
  const config = getGlmProviderConfigFromEnv({
    GLM_API_KEY: 'key-1',
    GLM_BASE_URL: 'https://example.test/v4/',
    GLM_MODEL: 'glm-test',
    GLM_TIMEOUT_MS: '2500',
  })

  assert.deepEqual(config, {
    apiKey: 'key-1',
    baseUrl: 'https://example.test/v4',
    model: 'glm-test',
    timeoutMs: 2500,
  })
})

test('GLM provider falls back to ZAI_API_KEY and current general endpoint', () => {
  const config = getGlmProviderConfigFromEnv({
    ZAI_API_KEY: 'key-2',
  })

  assert.equal(config?.apiKey, 'key-2')
  assert.equal(config?.baseUrl, 'https://api.z.ai/api/paas/v4')
  assert.equal(config?.model, 'glm-5.2')
})

test('GLM chat completion sends an OpenAI-compatible request', async () => {
  const calls: Array<{
    body: unknown
    headers: Headers
    url: string
  }> = []

  const content = await createGlmChatCompletion(
    [
      {
        role: 'user',
        content: 'Summarize this page.',
      },
    ],
    {
      apiKey: 'key-1',
      baseUrl: 'https://example.test/v4',
      model: 'glm-test',
      timeoutMs: 1000,
    },
    async (url, init) => {
      calls.push({
        body: JSON.parse(String(init?.body)),
        headers: new Headers(init?.headers),
        url: String(url),
      })

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'Decision log draft',
              },
            },
          ],
        }),
        {
          status: 200,
        }
      )
    }
  )

  assert.equal(content, 'Decision log draft')
  assert.equal(
    calls[0].url,
    'https://example.test/v4/chat/completions'
  )
  assert.equal(calls[0].headers.get('authorization'), 'Bearer key-1')
  assert.deepEqual(calls[0].body, {
    model: 'glm-test',
    messages: [
      {
        role: 'user',
        content: 'Summarize this page.',
      },
    ],
    temperature: 0.2,
  })
})

test('GLM decision log prompt includes page and area context', async () => {
  const prompts: string[] = []

  const text = await createGlmDecisionLogText(
    {
      pageTitle: 'MCP Plan',
      areas: [
        {
          id: 'area-1',
          text: 'Decision: start with read tools.',
        },
      ],
    },
    {
      apiKey: 'key-1',
      baseUrl: 'https://example.test/v4',
      model: 'glm-test',
      timeoutMs: 1000,
    },
    async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: string }>
      }
      prompts.push(body.messages.map((message) => message.content).join('\n'))

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'AI decision log',
              },
            },
          ],
        })
      )
    }
  )

  assert.equal(text, 'AI decision log')
  assert.match(prompts[0], /MCP Plan/)
  assert.match(prompts[0], /area-1/)
  assert.match(prompts[0], /Decision: start with read tools/)
})
