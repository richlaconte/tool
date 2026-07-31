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

test('pressing / with an Area selected opens the command box and styles the Area without touching its text', async ({
  page,
}) => {
  await gotoFreshPage(page)
  await waitForConnected(page)

  const shell = await createAreaAt(page, 600, 450)

  await page.keyboard.type('keep this text')
  await page.keyboard.press('Escape')

  await shell.hover()
  await shell.getByLabel('Move area').click()

  await page.keyboard.press('/')

  const commandBox = page.locator('.area-command-box')
  const commandBoxInput = page.locator('.area-command-box-input')

  await expect(commandBox).toBeVisible()
  await expect(commandBoxInput).toBeFocused()

  // The box anchors above the Area, never covering it.
  await expect(commandBox).toHaveAttribute('data-placement', 'above')

  const boxBounds = await commandBox.boundingBox()
  const areaBounds = await shell.boundingBox()

  expect(boxBounds).not.toBeNull()
  expect(areaBounds).not.toBeNull()
  expect(boxBounds!.y + boxBounds!.height).toBeLessThanOrEqual(
    areaBounds!.y + 1
  )

  await page.keyboard.type('border: 2px solid red')
  await page.keyboard.press('Enter')

  const area = shell.locator('.area')

  await expect(area).toHaveCSS('border-top-width', '2px')
  await expect(area).toHaveCSS('border-top-style', 'solid')
  await expect(area).toHaveCSS('border-top-color', 'rgb(255, 0, 0)')
  await expect(commandBox).toHaveCount(0)

  // The section's text was never touched.
  await expect(shell).toContainText('keep this text')
})

test('escape closes the command box without applying anything', async ({
  page,
}) => {
  await gotoFreshPage(page)
  await waitForConnected(page)

  const shell = await createAreaAt(page, 600, 300)

  await page.keyboard.press('Escape')
  await shell.hover()
  await shell.getByLabel('Move area').click()

  await page.keyboard.press('/')
  await page.keyboard.type('border: 2px solid red')
  await page.keyboard.press('Escape')

  await expect(page.locator('.area-command-box')).toHaveCount(0)
  await expect(shell.locator('.area')).not.toHaveCSS(
    'border-top-width',
    '2px'
  )
  // The Area stays selected after the box closes.
  await expect(shell.locator('.area--selected')).toHaveCount(1)
})

test('the Area toolbar button opens the command box', async ({ page }) => {
  await gotoFreshPage(page)
  await waitForConnected(page)

  const shell = await createAreaAt(page, 600, 300)

  await page.keyboard.press('Escape')
  await shell.hover()
  await shell.getByLabel('Open command box').click()

  await expect(page.locator('.area-command-box-input')).toBeFocused()

  await page.keyboard.type('opacity 0.5')
  await page.keyboard.press('Enter')

  await expect(shell.locator('.area')).toHaveCSS('opacity', '0.5')
})

test('the command box styles every selected Area', async ({ page }) => {
  await gotoFreshPage(page)
  await waitForConnected(page)

  const first = await createAreaAt(page, 300, 200)

  await page.keyboard.press('Escape')

  const second = await createAreaAt(page, 800, 450)

  await page.keyboard.press('Escape')

  await first.hover()
  await first.getByLabel('Move area').click()
  await second.hover()
  await second.getByLabel('Move area').click({ modifiers: ['Shift'] })

  await page.keyboard.press('/')

  await expect(
    page.locator('.area-command-box-hints')
  ).toContainText('Applies to 2 selected areas')

  await page.keyboard.type('border: 4px dashed blue')
  await page.keyboard.press('Enter')

  await expect(first.locator('.area')).toHaveCSS(
    'border-top-width',
    '4px'
  )
  await expect(second.locator('.area')).toHaveCSS(
    'border-top-width',
    '4px'
  )
  await expect(second.locator('.area')).toHaveCSS(
    'border-top-style',
    'dashed'
  )
})
