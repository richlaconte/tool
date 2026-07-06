import { expect, test, type APIRequestContext } from '@playwright/test'

import { areaLocator, createAreaAt, gotoFreshPage, waitForConnected } from './helpers'

const callMcpTool = (
  request: APIRequestContext,
  token: string | null,
  name: string,
  args: Record<string, unknown>
) =>
  request.post('/api/mcp', {
    data: {
      id: 1,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { arguments: args, name },
    },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

test('the agent loop: scoped MCP access plus human proposal review', async ({
  page,
}) => {
  const { pageId } = await gotoFreshPage(page)

  await waitForConnected(page)
  await createAreaAt(page, 600, 300)
  await page.keyboard.type('Decision: test the agent loop end to end')

  // MCP access is a per-page opt-in (fail-closed default).
  await page.keyboard.press('Escape')
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox').fill('Page styles')
  await page.keyboard.press('Enter')
  await page.getByLabel('Allow MCP access').check()
  await page.keyboard.press('Escape')

  // Fail closed: no token, no access.
  const anonymous = await callMcpTool(page.request, null, 'get_page', {
    pageId,
  })

  expect(anonymous.status()).toBe(401)

  // Mint a suggest-scoped token using the edit session cookie.
  const minted = await page.request.post(`/api/pages/${pageId}/mcp-tokens`, {
    data: {
      label: 'E2E agent',
      scopes: ['page:read', 'page:suggest'],
    },
  })

  expect(minted.ok()).toBe(true)

  const { token } = (await minted.json()) as { token: string }

  expect(token).toBeTruthy()

  // The agent reads the live page (poll: server persistence is debounced).
  await expect(async () => {
    const read = await callMcpTool(page.request, token, 'get_page', {
      pageId,
    })

    expect(read.ok()).toBe(true)

    const payload = (await read.json()) as { result?: unknown }

    expect(JSON.stringify(payload.result)).toContain(
      'test the agent loop end to end'
    )
  }).toPass()

  // Suggest scope can propose…
  const suggested = await callMcpTool(
    page.request,
    token,
    'suggest_areas',
    { pageId }
  )

  expect(suggested.ok()).toBe(true)

  const suggestion = (await suggested.json()) as {
    result?: { operations?: unknown[] }
  }

  expect(Array.isArray(suggestion.result?.operations)).toBe(true)

  // …but must not reach write tools.
  const write = await callMcpTool(page.request, token, 'create_area', {
    height: 100,
    pageId,
    text: 'should be denied',
    width: 200,
    x: 0,
    y: 0,
  })
  const writePayload = (await write.json()) as {
    error?: { message?: string }
  }

  expect(writePayload.error).toBeTruthy()

  // Human review: open the in-app agent proposal and apply it.
  await page.keyboard.press('Escape')
  await page.keyboard.press('ControlOrMeta+k')

  const paletteInput = page.getByRole('combobox')

  await paletteInput.fill('Agent suggestions')
  await page.keyboard.press('Enter')

  await page
    .getByRole('button', { name: 'Apply proposal', exact: true })
    .click()

  await expect(
    areaLocator(page).filter({ hasText: 'Agent proposal: decision log' })
  ).toHaveCount(1)

  // Applying closes the dialog; reopen it to see the audit record.
  await page.keyboard.press('ControlOrMeta+k')
  await paletteInput.fill('Agent suggestions')
  await page.keyboard.press('Enter')

  await expect(page.getByText('Last applied patch:')).toBeVisible()
})
