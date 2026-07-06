import { expect, test } from '@playwright/test'

import { createAreaAt, gotoFreshPage, waitForConnected } from './helpers'

test('a CSS slash command styles the Area element', async ({ page }) => {
  await gotoFreshPage(page)
  await waitForConnected(page)

  const shell = await createAreaAt(page, 600, 300)

  await page.keyboard.type('/border: 2px solid red')
  await page.keyboard.press('Enter')

  const area = shell.locator('.area')

  await expect(area).toHaveCSS('border-top-width', '2px')
  await expect(area).toHaveCSS('border-top-style', 'solid')
  await expect(area).toHaveCSS('border-top-color', 'rgb(255, 0, 0)')
})
