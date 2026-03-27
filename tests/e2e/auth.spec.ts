import { test, expect, type Page } from "@playwright/test";

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
}

test.describe("Authentication Flow", () => {
  test("should load login page", async ({ page }) => {
    await page.goto("/login");
    
    await expect(page).toHaveTitle(/LHFEX/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    
    await fillLoginForm(page, "invalid@example.com", "wrongpassword");
    await page.locator('button[type="submit"]').click();
    
    await expect(page.getByText(/incorretos|incorrect/i)).toBeVisible();
  });

  test("should login successfully with valid credentials", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[name="csrf"]')).toBeAttached();
    
    // Use credentials from seed file (admin user)
    await fillLoginForm(page, "luiz@lhfex.com.br", "lhfex2025!");
    
    // Should redirect to dashboard
    await Promise.all([
      page.waitForURL(/\/($|dashboard)/, { timeout: 25000 }),
      page.locator('button[type="submit"]').click(),
    ]);
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page).not.toHaveURL(/\/login$/);
  });
});
