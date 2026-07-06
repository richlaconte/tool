import { expect, type Page } from '@playwright/test'

export const areaLocator = (page: Page) => page.locator('[data-area-id]')

export const canvasSurface = (page: Page) =>
  page.getByTestId('canvas-surface')

export const gotoFreshPage = async (page: Page) => {
  await page.goto('/')
  await page.waitForURL(/\/p\//)

  const pageId = new URL(page.url()).pathname.split('/')[2]

  await expect(canvasSurface(page)).toBeVisible()

  return { editUrl: page.url(), pageId }
}

export const createAreaAt = async (page: Page, x: number, y: number) => {
  const before = await areaLocator(page).count()

  await canvasSurface(page).click({ position: { x, y } })
  await expect(areaLocator(page)).toHaveCount(before + 1)

  return areaLocator(page).nth(before)
}

export const waitForConnected = async (page: Page) => {
  await expect(page.getByText('Connected', { exact: true })).toBeVisible()
}
