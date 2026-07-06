import { expect, test } from '@playwright/test'

import { areaLocator, createAreaAt, gotoFreshPage, waitForConnected } from './helpers'

test('creating an Area and typing text survives a reload', async ({
  page,
}) => {
  await gotoFreshPage(page)
  await waitForConnected(page)

  await createAreaAt(page, 600, 300)
  await page.keyboard.type('Hello from Playwright')

  await expect(areaLocator(page).first()).toContainText(
    'Hello from Playwright'
  )

  await page.reload()

  await expect(areaLocator(page).first()).toContainText(
    'Hello from Playwright'
  )
})
