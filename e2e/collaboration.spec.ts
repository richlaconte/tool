import { expect, test } from '@playwright/test'

import { areaLocator, createAreaAt, gotoFreshPage, waitForConnected } from './helpers'

const dragAreaBy = async (
  page: import('@playwright/test').Page,
  dx: number,
  dy: number
) => {
  const shell = areaLocator(page).first()

  await shell.hover()

  const handle = shell.getByLabel('Move area')
  const handleBox = await handle.boundingBox()

  if (!handleBox) throw new Error('Move handle has no bounding box.')

  const startX = handleBox.x + handleBox.width / 2
  const startY = handleBox.y + handleBox.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + dx, startY + dy, { steps: 8 })
  await page.mouse.up()
}

test('two browsers collaborate live on the same page', async ({
  browser,
  page,
}) => {
  await gotoFreshPage(page)
  await waitForConnected(page)

  // A creates content first, then shares — opening the share dialog mints
  // the server share links, and the address bar URL has already exchanged
  // its own token for a session cookie.
  await createAreaAt(page, 600, 300)
  await page.keyboard.type('Typed by A')

  await page.getByRole('button', { name: 'Share', exact: true }).click()

  const editUrlInput = page.getByLabel('Can edit URL')

  await expect(editUrlInput).toHaveValue(/share=edit&token=[\w-]{10,}/)

  const editUrl = await editUrlInput.inputValue()

  await page.keyboard.press('Escape')

  const otherContext = await browser.newContext()
  const otherPage = await otherContext.newPage()

  await otherPage.goto(editUrl)
  await waitForConnected(otherPage)

  // B sees A's content live.
  await expect(areaLocator(otherPage).first()).toContainText('Typed by A')

  // B moves the Area and the move takes effect for B.
  const beforeBoxB = await areaLocator(otherPage).first().boundingBox()

  if (!beforeBoxB) throw new Error('Area has no bounding box on B.')

  await dragAreaBy(otherPage, 160, 90)

  await expect(async () => {
    const afterBoxB = await areaLocator(otherPage).first().boundingBox()

    if (!afterBoxB) throw new Error('Area has no box on B.')

    expect(afterBoxB.x).toBeGreaterThan(beforeBoxB.x + 40)
  }).toPass()

  // Both clients' writes are durable: a fresh third browser sees A's text
  // at B's moved position.
  const readerContext = await browser.newContext()
  const readerPage = await readerContext.newPage()

  await readerPage.goto(editUrl)
  await waitForConnected(readerPage)

  const readerShell = areaLocator(readerPage).first()

  await expect(readerShell).toContainText('Typed by A')

  await expect(async () => {
    const readerBox = await readerShell.boundingBox()
    const boxOnB = await areaLocator(otherPage).first().boundingBox()

    if (!readerBox || !boxOnB) throw new Error('Area box is missing.')

    expect(Math.abs(readerBox.x - boxOnB.x)).toBeLessThan(2)
    expect(Math.abs(readerBox.y - boxOnB.y)).toBeLessThan(2)
  }).toPass()

  await readerContext.close()
  await otherContext.close()
})

// Regression coverage for the historical one-way sync loss: a client that
// creates an Area after connecting must still receive another user's live
// edits to that same Area.
test(
  'remote edits converge back to the client that created the Area',
  async ({ browser, page }) => {
    await gotoFreshPage(page)
    await waitForConnected(page)
    await createAreaAt(page, 600, 300)
    await page.keyboard.type('Typed by A')

    await page.getByRole('button', { name: 'Share', exact: true }).click()

    const editUrlInput = page.getByLabel('Can edit URL')

    await expect(editUrlInput).toHaveValue(/share=edit&token=[\w-]{10,}/)

    const editUrl = await editUrlInput.inputValue()

    await page.keyboard.press('Escape')

    const beforeBoxA = await areaLocator(page).first().boundingBox()

    if (!beforeBoxA) throw new Error('Area has no bounding box on A.')

    const otherContext = await browser.newContext()
    const otherPage = await otherContext.newPage()

    await otherPage.goto(editUrl)
    await waitForConnected(otherPage)
    await expect(areaLocator(otherPage).first()).toContainText('Typed by A')

    await dragAreaBy(otherPage, 160, 90)

    await expect(async () => {
      const afterBoxA = await areaLocator(page).first().boundingBox()

      if (!afterBoxA) throw new Error('Area has no box on A.')

      expect(afterBoxA.x).toBeGreaterThan(beforeBoxA.x + 40)
    }).toPass()

    await otherContext.close()
  }
)

// Opens the Share dialog on `page` and reads out a minted share URL.
const mintShareUrl = async (
  page: import('@playwright/test').Page,
  mode: 'edit' | 'view'
) => {
  await page.getByRole('button', { name: 'Share', exact: true }).click()

  const urlInput = page.getByLabel(mode === 'edit' ? 'Can edit URL' : 'Can view URL')

  await expect(urlInput).toHaveValue(new RegExp(`share=${mode}&token=[\\w-]{10,}`))

  const url = await urlInput.inputValue()

  await page.keyboard.press('Escape')

  return url
}

// Ensures the first Area is in text-editing mode (idle Areas render as
// markdown and only mount the contenteditable once focused), then returns
// the editable element with the caret at the end of the text.
const editFirstArea = async (page: import('@playwright/test').Page) => {
  const area = areaLocator(page).first()
  const editable = area.locator('[contenteditable]')

  if ((await editable.count()) === 0) {
    await area.locator('.area-editor').click()
  }

  await expect(editable).toBeVisible()

  return editable
}

test('collaborators see each other in the presence indicator', async ({
  browser,
  page,
}) => {
  await gotoFreshPage(page)
  await waitForConnected(page)

  const editUrl = await mintShareUrl(page, 'edit')

  const otherContext = await browser.newContext()
  const otherPage = await otherContext.newPage()

  await otherPage.goto(editUrl)
  await waitForConnected(otherPage)

  const remoteAvatars = (target: import('@playwright/test').Page) =>
    target
      .getByLabel('Collaboration presence')
      .locator(
        '.presence-avatar:not(.presence-avatar--local):not(.presence-avatar--agent)'
      )

  await expect(remoteAvatars(page)).toHaveCount(1)
  await expect(remoteAvatars(otherPage)).toHaveCount(1)

  // When B leaves, A's presence indicator empties again.
  await otherContext.close()

  await expect(remoteAvatars(page)).toHaveCount(0)
})

test('simultaneous edits to the same Area converge for both users', async ({
  browser,
  page,
}) => {
  await gotoFreshPage(page)
  await waitForConnected(page)
  await createAreaAt(page, 600, 300)
  await page.keyboard.type('shared')

  const editUrl = await mintShareUrl(page, 'edit')

  const otherContext = await browser.newContext()
  const otherPage = await otherContext.newPage()

  await otherPage.goto(editUrl)
  await waitForConnected(otherPage)
  await expect(areaLocator(otherPage).first()).toContainText('shared')

  // Both users type into the same Area at overlapping times.
  const editableA = await editFirstArea(page)
  const editableB = await editFirstArea(otherPage)

  await editableA.click()
  await page.keyboard.type(' from-A')

  await editableB.click()
  await otherPage.keyboard.type(' from-B')

  await page.keyboard.type('-more-A')
  await otherPage.keyboard.type('-more-B')

  // Whatever the interleaving, both clients must converge to identical text.
  await expect(async () => {
    const textA = await editableA.innerText()
    const textB = await editableB.innerText()

    expect(textA).toBe(textB)
  }).toPass({ timeout: 15_000 })

  await otherContext.close()
})

test('a reconnecting client catches up on edits made while offline', async ({
  browser,
  page,
}) => {
  await gotoFreshPage(page)
  await waitForConnected(page)
  await createAreaAt(page, 600, 300)
  await page.keyboard.type('before-offline')

  const editUrl = await mintShareUrl(page, 'edit')

  const otherContext = await browser.newContext()
  const otherPage = await otherContext.newPage()

  await otherPage.goto(editUrl)
  await waitForConnected(otherPage)
  await expect(areaLocator(otherPage).first()).toContainText('before-offline')

  // B drops offline; A keeps editing.
  await otherContext.setOffline(true)

  const areaEditor = await editFirstArea(page)

  await areaEditor.click()
  await page.keyboard.type(' while-away')

  await expect(areaEditor).toContainText('while-away')

  // B returns and must catch up on what it missed.
  await otherContext.setOffline(false)
  await waitForConnected(otherPage)

  await expect(areaLocator(otherPage).first()).toContainText(
    'before-offline while-away',
    { timeout: 15_000 }
  )

  await otherContext.close()
})

test('a view-link client receives live updates without editing', async ({
  browser,
  page,
}) => {
  await gotoFreshPage(page)
  await waitForConnected(page)
  await createAreaAt(page, 600, 300)
  await page.keyboard.type('version one')

  const viewUrl = await mintShareUrl(page, 'view')

  const viewerContext = await browser.newContext()
  const viewerPage = await viewerContext.newPage()

  await viewerPage.goto(viewUrl)
  await expect(areaLocator(viewerPage).first()).toContainText('version one')

  // The editor keeps working; the read-only viewer follows live.
  const areaEditor = await editFirstArea(page)

  await areaEditor.click()
  await page.keyboard.type(' plus more')

  await expect(areaLocator(viewerPage).first()).toContainText(
    'version one plus more',
    { timeout: 15_000 }
  )

  await viewerContext.close()
})
