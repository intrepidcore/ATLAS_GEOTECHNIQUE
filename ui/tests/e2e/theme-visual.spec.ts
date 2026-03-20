import { test, expect } from '@playwright/test'

async function setThemeMode(page: any, mode: 'light' | 'dark') {
  await page.addInitScript((m: string) => {
    try {
      localStorage.setItem('atlas_theme_mode', m)
    } catch {
      // ignore
    }
  }, mode)
}

test.describe('Theme visual regression', () => {
  test('login page (light)', async ({ page }) => {
    await setThemeMode(page, 'light')
    await page.goto('/login.html')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('login-light.png', { fullPage: true })
  })

  test('login page (dark)', async ({ page }) => {
    await setThemeMode(page, 'dark')
    await page.goto('/login.html')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('login-dark.png', { fullPage: true })
  })
})
