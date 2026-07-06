import { expect, test } from '@playwright/test'

import { areaLocator, canvasSurface, createAreaAt, gotoFreshPage, waitForConnected } from './helpers'

test('a view link shows content without edit affordances', async ({
  browser,
  page,
}) => {
  await gotoFreshPage(page)
  await waitForConnected(page)

  await createAreaAt(page, 600, 300)
  await page.keyboard.type('Read-only content')

  await page.getByRole('button', { name: 'Share', exact: true }).click()

  const viewUrlInput = page.getByLabel('Can view URL')

  // The dialog may briefly render before the server-issued tokens land.
  await expect(viewUrlInput).toHaveValue(/share=view&token=[\w-]{10,}/)

  const viewUrl = await viewUrlInput.inputValue()
  const viewerContext = await browser.newContext()
  const viewerPage = await viewerContext.newPage()

  await viewerPage.goto(viewUrl)

  await expect(areaLocator(viewerPage).first()).toContainText(
    'Read-only content'
  )

  // No edit affordances: clicking blank canvas must not create an Area,
  // and Area text must not be editable.
  await canvasSurface(viewerPage).click({ position: { x: 250, y: 500 } })

  await expect(areaLocator(viewerPage)).toHaveCount(1)
  await expect(
    viewerPage.locator('[contenteditable="plaintext-only"]')
  ).toHaveCount(0)
  await expect(
    viewerPage.getByRole('button', { name: 'Share', exact: true })
  ).toHaveCount(0)

  await viewerContext.close()
})
