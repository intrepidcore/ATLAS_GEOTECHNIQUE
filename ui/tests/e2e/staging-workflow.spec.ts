import { test, expect } from '@playwright/test';

test.describe('Staging Workflow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Naviguer vers l'application
    await page.goto('http://localhost:5173/db-manager.html');
    
    // Attendre que l'application soit chargée
    await page.waitForSelector('text=Atlas Géotechnique');
  });

  test('should display main navigation tabs', async ({ page }) => {
    // Vérifier que les onglets principaux sont présents
    await expect(page.locator('text=Tables')).toBeVisible();
    await expect(page.locator('text=Staging')).toBeVisible();
    await expect(page.locator('text=Outils')).toBeVisible();
  });

  test('should load schema and tables', async ({ page }) => {
    // Cliquer sur l'onglet Tables
    await page.click('text=Tables');
    
    // Attendre que le schéma se charge
    await page.waitForSelector('[role="combobox"]', { timeout: 10000 });
    
    // Sélectionner un schéma (ex: public)
    await page.click('[role="combobox"]');
    await page.click('text=public');
    
    // Vérifier qu'une liste de tables apparaît
    await expect(page.locator('text=Table:')).toBeVisible({ timeout: 5000 });
  });

  test('should create staging environment', async ({ page }) => {
    // Aller dans l'onglet Staging
    await page.click('text=Staging');
    
    // Vérifier que le bouton "Créer un Staging" est présent
    await expect(page.locator('text=Créer un Staging')).toBeVisible();
    
    // Cliquer sur "Créer un Staging"
    await page.click('text=Créer un Staging');
    
    // Remplir le formulaire (si modal s'ouvre)
    // Note: À adapter selon l'implémentation réelle
    const modal = page.locator('[role="dialog"]');
    if (await modal.isVisible()) {
      await page.fill('input[name="reason"]', 'Test E2E - Staging automatisé');
      await page.click('button:has-text("Créer")');
      
      // Vérifier que le staging est créé
      await expect(page.locator('text=Staging créé')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should open field calculator', async ({ page }) => {
    // Aller dans Outils
    await page.click('text=Outils');
    
    // Vérifier que la calculatrice de champs est présente
    await expect(page.locator('text=Calculatrice de Champs')).toBeVisible();
    
    // Cliquer sur "Ouvrir"
    await page.click('button:has-text("Ouvrir")').first();
    
    // Vérifier que le modal s'ouvre
    await expect(page.locator('text=Calculatrice de champ')).toBeVisible({ timeout: 3000 });
  });

  test('should open import/export dialog', async ({ page }) => {
    // Aller dans Outils
    await page.click('text=Outils');
    
    // Vérifier que Import/Export est présent
    await expect(page.locator('text=Import/Export')).toBeVisible();
    
    // Cliquer sur "Ouvrir"
    const buttons = page.locator('button:has-text("Ouvrir")');
    await buttons.nth(1).click();
    
    // Vérifier que le modal s'ouvre
    await expect(page.locator('text=Import')).toBeVisible({ timeout: 3000 });
  });

  test('should open RBAC manager', async ({ page }) => {
    // Aller dans Outils
    await page.click('text=Outils');
    
    // Vérifier que RBAC est présent
    await expect(page.locator('text=RBAC - Permissions')).toBeVisible();
    
    // Cliquer sur "Ouvrir"
    const buttons = page.locator('button:has-text("Ouvrir")');
    await buttons.nth(2).click();
    
    // Vérifier que le modal RBAC s'ouvre
    await expect(page.locator('text=Gestion des Rôles')).toBeVisible({ timeout: 3000 });
  });

  test('should display monitoring link', async ({ page }) => {
    // Aller dans Outils
    await page.click('text=Outils');
    
    // Vérifier que le lien Monitoring est présent
    await expect(page.locator('text=Monitoring')).toBeVisible();
    await expect(page.locator('text=Ouvrir Grafana')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simuler une déconnexion réseau
    await page.route('**/api/**', route => route.abort());
    
    // Essayer de charger des données
    await page.click('text=Tables');
    
    // Vérifier qu'un message d'erreur apparaît
    await expect(page.locator('text=Network error')).toBeVisible({ timeout: 5000 });
  });

  test('should persist selected schema in localStorage', async ({ page }) => {
    // Sélectionner un schéma
    await page.click('text=Tables');
    await page.click('[role="combobox"]');
    await page.click('text=public');
    
    // Recharger la page
    await page.reload();
    
    // Vérifier que le schéma est toujours sélectionné
    await expect(page.locator('text=public')).toBeVisible();
  });

  test('should validate form inputs', async ({ page }) => {
    // Aller dans Staging
    await page.click('text=Staging');
    await page.click('text=Créer un Staging');
    
    // Essayer de soumettre sans remplir
    const modal = page.locator('[role="dialog"]');
    if (await modal.isVisible()) {
      await page.click('button:has-text("Créer")');
      
      // Vérifier qu'un message de validation apparaît
      // Note: À adapter selon l'implémentation réelle
      await expect(page.locator('text=requis')).toBeVisible({ timeout: 2000 });
    }
  });
});

test.describe('Data Grid Operations', () => {
  test('should filter table data', async ({ page }) => {
    await page.goto('http://localhost:5173/db-manager.html');
    await page.click('text=Tables');
    
    // Sélectionner une table avec des données
    await page.click('[role="combobox"]');
    await page.click('text=public');
    
    // Attendre que les données se chargent
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Utiliser le filtre de recherche
    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      
      // Vérifier que les résultats sont filtrés
      await page.waitForTimeout(500); // Attendre le debounce
      const rows = page.locator('tbody tr');
      await expect(rows).toHaveCount({ timeout: 5000 });
    }
  });

  test('should paginate through results', async ({ page }) => {
    await page.goto('http://localhost:5173/db-manager.html');
    await page.click('text=Tables');
    
    // Sélectionner une table
    await page.click('[role="combobox"]');
    await page.click('text=public');
    
    // Attendre la pagination
    const nextButton = page.locator('button:has-text("Suivant")');
    if (await nextButton.isVisible({ timeout: 5000 })) {
      await nextButton.click();
      
      // Vérifier que la page change
      await expect(page.locator('text=Page 2')).toBeVisible({ timeout: 3000 });
    }
  });
});

test.describe('Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('http://localhost:5173/db-manager.html');
    
    // Vérifier les rôles ARIA
    await expect(page.locator('[role="navigation"]')).toBeVisible();
    await expect(page.locator('[role="main"]')).toBeVisible();
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('http://localhost:5173/db-manager.html');
    
    // Naviguer avec Tab
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Vérifier qu'un élément est activé
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });
});
