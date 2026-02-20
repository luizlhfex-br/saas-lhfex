import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should load login page", async ({ page }) => {
    await page.goto("/login");
    
    await expect(page).toHaveTitle(/LHFEX/);
    await expect(page.getByRole("heading", { name: /login/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("should show error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    
    await page.getByLabel(/email/i).fill("invalid@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /entrar|login/i }).click();
    
    await expect(page.getByText(/incorretos|incorrect/i)).toBeVisible();
  });

  test("should login successfully with valid credentials", async ({ page }) => {
    await page.goto("/login");
    
    // Use credentials from seed file (admin user)
    await page.getByLabel(/email/i).fill("luiz@lhfex.com.br");
    await page.getByLabel(/password/i).fill("Admin123!");
    await page.getByRole("button", { name: /entrar|login/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(dashboard)?$/);
    await expect(page.getByText(/dashboard|painel/i)).toBeVisible();
  });
});
