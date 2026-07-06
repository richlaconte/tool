import { expect, test } from '@playwright/test'

import { areaLocator, canvasSurface, createAreaAt, gotoFreshPage, waitForConnected } from './helpers'

// Regression guard for the deselect fix streak (f550660, a255519, 178c42d):
// with an Area selected, the first blank-canvas click deselects and must NOT
// create a new Area; the next blank-canvas click creates one.
test('blank canvas click deselects first, creates second', async ({
  page,
}) => {
  await gotoFreshPage(page)
  await waitForConnected(page)

  const shell = await createAreaAt(page, 600, 300)
  const area = shell.locator('.area')

  await expect(area).toHaveClass(/area--selected/)

  await canvasSurface(page).click({ position: { x: 200, y: 600 } })

  await expect(area).not.toHaveClass(/area--selected/)
  await expect(areaLocator(page)).toHaveCount(1)

  const editableFocused = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[data-area-id]'))
  )

  expect(editableFocused).toBe(false)

  await canvasSurface(page).click({ position: { x: 200, y: 600 } })

  await expect(areaLocator(page)).toHaveCount(2)
})
