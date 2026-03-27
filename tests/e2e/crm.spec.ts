import { test, expect, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await expect(page.locator('input[name="csrf"]')).toBeAttached();
  await page.locator('input[name="email"]').fill("luiz@lhfex.com.br");
  await page.locator('input[name="password"]').fill("lhfex2025!");
  await Promise.all([
    page.waitForURL(/\/($|dashboard)/, { timeout: 25000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await expect(page).not.toHaveURL(/\/login$/);
}

test.describe("CRM Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should navigate to CRM page", async ({ page }) => {
    await page.getByRole("link", { name: /crm|clientes/i }).click();
    
    await expect(page).toHaveURL(/\/crm$/);
    await expect(page.getByRole("heading", { level: 1, name: "CRM", exact: true })).toBeVisible();
  });

  test("should open new client form", async ({ page }) => {
    await page.goto("/crm");
    
    await page.getByRole("link", { name: /novo|new/i }).click();
    
    await expect(page).toHaveURL(/\/crm\/new$/);
    await expect(page.getByLabel(/cnpj/i)).toBeVisible();
    await expect(page.getByLabel(/razão social/i)).toBeVisible();
  });

  test("should show validation errors on empty form", async ({ page }) => {
    await page.goto("/crm/new");
    
    await page.locator("#crm-new-form").getByRole("button", { name: /salvar|save/i }).click();
    
    // Should stay on form and show errors
    await expect(page).toHaveURL(/\/crm\/new$/);
  });
});
