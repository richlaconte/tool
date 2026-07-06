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
