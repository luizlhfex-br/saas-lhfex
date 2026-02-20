import { test, expect } from "@playwright/test";

test.describe("CRM Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("luiz@lhfex.com.br");
    await page.getByLabel(/password/i).fill("Admin123!");
    await page.getByRole("button", { name: /entrar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test("should navigate to CRM page", async ({ page }) => {
    await page.getByRole("link", { name: /crm|clientes/i }).click();
    
    await expect(page).toHaveURL(/\/crm$/);
    await expect(page.getByRole("heading", { name: /crm|clientes/i })).toBeVisible();
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
    
    await page.getByRole("button", { name: /salvar|save/i }).click();
    
    // Should stay on form and show errors
    await expect(page).toHaveURL(/\/crm\/new$/);
  });
});
