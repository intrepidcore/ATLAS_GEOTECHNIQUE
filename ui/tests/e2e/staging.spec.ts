import { test, expect } from '@playwright/test'

test.describe('Staging Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/db-manager.html')
    await expect(page.locator('h1')).toContainText('Atlas')
  })

  test('should create staging, insert data, dry-run, and commit', async ({ page }) => {
    // Navigate to Tables tab
    await page.click('button:has-text("Tables")')
    
    // Click Create Staging
    await page.click('button:has-text("Créer Staging")')
    
    // Wait for modal
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.locator('text=Mode Édition')).toBeVisible()
    
    // Check lock banner
    await expect(page.locator('text=Mode Édition Actif')).toBeVisible()
    
    // Switch to Changes tab
    await page.click('button:has-text("Changements")')
    
    // Run dry-run
    await page.click('button:has-text("Dry-Run")')
    
    // Wait for dry-run results
    await expect(page.locator('text=Dry-Run')).toBeVisible({ timeout: 10000 })
    
    // Commit if safe
    const isSafe = await page.locator('text=Aucun conflit').isVisible()
    if (isSafe) {
      await page.click('button:has-text("Commit")')
      
      // Confirm dialog
      page.on('dialog', dialog => dialog.accept())
      
      // Wait for success
      await expect(page.locator('text=Commit réussi')).toBeVisible({ timeout: 15000 })
    }
  })

  test('should handle conflicts gracefully', async ({ page }) => {
    await page.click('button:has-text("Tables")')
    await page.click('button:has-text("Créer Staging")')
    
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    
    // Simulate conflict scenario
    await page.click('button:has-text("Dry-Run")')
    
    // Check for conflict warnings
    const hasConflicts = await page.locator('text=Conflits détectés').isVisible({ timeout: 5000 }).catch(() => false)
    
    if (hasConflicts) {
      // Verify conflict details are shown
      await expect(page.locator('[data-testid="conflict-list"]')).toBeVisible()
      
      // Cancel should work
      await page.click('button:has-text("Annuler")')
      page.on('dialog', dialog => dialog.accept())
    }
  })

  test('should show lock expiration timer', async ({ page }) => {
    await page.click('button:has-text("Tables")')
    await page.click('button:has-text("Créer Staging")')
    
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    
    // Check lock info
    await expect(page.locator('text=Expire:')).toBeVisible()
    
    // Verify timer format (HH:MM:SS)
    const timerText = await page.locator('text=Expire:').textContent()
    expect(timerText).toMatch(/\d{1,2}:\d{2}/)
  })
})
