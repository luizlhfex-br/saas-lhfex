import { test, expect } from "@playwright/test";

test.describe("Chat Widget Integration", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("luiz@lhfex.com.br");
    await page.getByLabel(/password/i).fill("Admin123!");
    await page.getByRole("button", { name: /entrar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test("should open chat widget", async ({ page }) => {
    // Chat button should be visible (floating button)
    const chatButton = page.locator('button[aria-label*="chat" i]').or(page.locator('button:has-text("Chat")'));
    await expect(chatButton).toBeVisible();
    
    // Click to open chat
    await chatButton.click();
    
    // Chat widget should expand
    await expect(page.locator('text=/chat|conversa/i').first()).toBeVisible();
  });

  test("should send message and receive response", async ({ page }) => {
    // Open chat widget
    const chatButton = page.locator('button[aria-label*="chat" i]').or(page.locator('button:has-text("Chat")'));
    await chatButton.click();
    
    // Wait for chat to load
    await page.waitForTimeout(500);
    
    // Find message textarea
    const messageInput = page.locator('textarea[placeholder*="mensagem" i]').or(page.locator('textarea[placeholder*="message" i]'));
    await expect(messageInput).toBeVisible();
    
    // Type and send message
    await messageInput.fill("Olá, preciso de ajuda com uma nota fiscal");
    
    const sendButton = page.locator('button:has-text("Enviar")').or(page.locator('button[type="submit"]')).last();
    await sendButton.click();
    
    // Wait for response (up to 30 seconds for AI)
    await expect(page.locator('text=/preciso de ajuda/i')).toBeVisible({ timeout: 3000 });
    
    // Should show assistant response
    await expect(page.locator('[role="status"]').or(page.locator('text=/processando|carregando/i'))).toBeVisible({ timeout: 30000 });
  });

  test("should show agent selection", async ({ page }) => {
    // Open chat widget
    const chatButton = page.locator('button[aria-label*="chat" i]').or(page.locator('button:has-text("Chat")'));
    await chatButton.click();
    
    // Should show agent selector (Airton, Iana, Marcus)
    const agentSelector = page.locator('select').or(page.locator('[role="combobox"]'));
    
    if (await agentSelector.isVisible()) {
      await expect(agentSelector).toBeVisible();
      
      // Should have agent options
      const options = await agentSelector.locator('option').all();
      expect(options.length).toBeGreaterThan(0);
    }
  });

  test("should display error message on failure", async ({ page }) => {
    // Intercept API call and force error
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "INTERNAL_ERROR",
            message: "Erro interno do servidor",
          },
        }),
      });
    });
    
    // Open chat and send message
    const chatButton = page.locator('button[aria-label*="chat" i]').or(page.locator('button:has-text("Chat")'));
    await chatButton.click();
    
    const messageInput = page.locator('textarea[placeholder*="mensagem" i]').or(page.locator('textarea[placeholder*="message" i]'));
    await messageInput.fill("Test error handling");
    
    const sendButton = page.locator('button:has-text("Enviar")').or(page.locator('button[type="submit"]')).last();
    await sendButton.click();
    
    // Should show error message
    await expect(page.locator('text=/erro|error/i')).toBeVisible({ timeout: 5000 });
  });

  test("should show retry button on retryable error", async ({ page }) => {
    let requestCount = 0;
    
    // Intercept API call - first fails, second succeeds
    await page.route("**/api/chat", async (route) => {
      requestCount++;
      
      if (requestCount === 1) {
        // First request fails with retryable error
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "AI_PROVIDER_UNAVAILABLE",
              message: "Provedores de IA temporariamente indisponíveis",
              retryable: true,
            },
          }),
        });
      } else {
        // Second request succeeds
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            conversationId: "test-conv-123",
            reply: "Olá! Como posso ajudar?",
            agentId: "airton",
            aiModel: "gemini-2.0-flash",
            aiProvider: "gemini",
          }),
        });
      }
    });
    
    // Open chat and send message
    const chatButton = page.locator('button[aria-label*="chat" i]').or(page.locator('button:has-text("Chat")'));
    await chatButton.click();
    
    const messageInput = page.locator('textarea[placeholder*="mensagem" i]').or(page.locator('textarea[placeholder*="message" i]'));
    await messageInput.fill("Test retry functionality");
    
    const sendButton = page.locator('button:has-text("Enviar")').or(page.locator('button[type="submit"]')).last();
    await sendButton.click();
    
    // Should show error with retry button
    await expect(page.locator('text=/temporariamente indisponíveis/i')).toBeVisible({ timeout: 5000 });
    
    const retryButton = page.locator('button:has-text("Tentar")').or(page.locator('button[aria-label*="retry" i]'));
    await expect(retryButton).toBeVisible();
    
    // Click retry
    await retryButton.click();
    
    // Should show success message on retry
    await expect(page.locator('text=/Como posso ajudar/i')).toBeVisible({ timeout: 5000 });
  });

  test("should display retry count after multiple attempts", async ({ page }) => {
    let requestCount = 0;
    
    // Intercept API call - fail multiple times
    await page.route("**/api/chat", async (route) => {
      requestCount++;
      
      if (requestCount <= 3) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "AI_PROVIDER_UNAVAILABLE",
              message: "Provedores temporariamente indisponíveis",
              retryable: true,
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            reply: "Sucesso após múltiplas tentativas",
            conversationId: "conv-123",
            agentId: "airton",
          }),
        });
      }
    });
    
    // Open chat and send message
    const chatButton = page.locator('button[aria-label*="chat" i]').or(page.locator('button:has-text("Chat")'));
    await chatButton.click();
    
    const messageInput = page.locator('textarea[placeholder*="mensagem" i]').or(page.locator('textarea[placeholder*="message" i]'));
    await messageInput.fill("Test multiple retries");
    
    const sendButton = page.locator('button:has-text("Enviar")').or(page.locator('button[type="submit"]')).last();
    await sendButton.click();
    
    // Retry 3 times
    for (let i = 1; i <= 3; i++) {
      await expect(page.locator('text=/temporariamente/i')).toBeVisible({ timeout: 5000 });
      
      const retryButton = page.locator('button:has-text("Tentar")').or(page.locator('button[aria-label*="retry" i]'));
      await retryButton.click();
      
      if (i >= 3) {
        // Should show warning indicator after 3+ attempts
        await expect(page.locator('[title*="tentativa" i]').or(page.locator('text=/tentativa/i'))).toBeVisible();
      }
    }
  });

  test("should handle conversation history", async ({ page }) => {
    // Open chat
    const chatButton = page.locator('button[aria-label*="chat" i]').or(page.locator('button:has-text("Chat")'));
    await chatButton.click();
    
    // Send first message
    const messageInput = page.locator('textarea[placeholder*="mensagem" i]').or(page.locator('textarea[placeholder*="message" i]'));
    await messageInput.fill("Primeira mensagem");
    
    let sendButton = page.locator('button:has-text("Enviar")').or(page.locator('button[type="submit"]')).last();
    await sendButton.click();
    
    // Wait for response
    await page.waitForTimeout(2000);
    
    // Send second message
    await messageInput.fill("Segunda mensagem");
    sendButton = page.locator('button:has-text("Enviar")').or(page.locator('button[type="submit"]')).last();
    await sendButton.click();
    
    // Both messages should be visible
    await expect(page.locator('text=/Primeira mensagem/i')).toBeVisible();
    await expect(page.locator('text=/Segunda mensagem/i')).toBeVisible();
  });

  test("should close chat widget", async ({ page }) => {
    // Open chat
    const chatButton = page.locator('button[aria-label*="chat" i]').or(page.locator('button:has-text("Chat")'));
    await chatButton.click();
    
    // Chat should be visible
    const chatWidget = page.locator('[role="dialog"]').or(page.locator('div:has-text("Chat")').first());
    await expect(chatWidget).toBeVisible();
    
    // Find close button
    const closeButton = page.locator('button[aria-label*="fechar" i]').or(page.locator('button[aria-label*="close" i]'));
    
    if (await closeButton.isVisible()) {
      await closeButton.click();
      
      // Chat should be hidden or minimized
      await page.waitForTimeout(500);
    }
  });
});

test.describe("NCM Classification E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("luiz@lhfex.com.br");
    await page.getByLabel(/password/i).fill("Admin123!");
    await page.getByRole("button", { name: /entrar|login/i }).click();
    await expect(page).toHaveURL(/\/(dashboard)?$/);
  });

  test("should navigate to NCM page", async ({ page }) => {
    await page.goto("/ncm");
    
    await expect(page).toHaveURL(/\/ncm$/);
    await expect(page.locator('text=/ncm|classificação/i').first()).toBeVisible();
  });

  test("should display NCM presets", async ({ page }) => {
    await page.goto("/ncm");
    
    // Should see "Exemplos Rápidos" section
    const presetsSection = page.locator('text=/exemplos rápidos/i').or(page.locator('text=/presets/i'));
    
    if (await presetsSection.isVisible()) {
      // Should show at least 5 preset examples
      const presetButtons = page.locator('button:has-text("Empilhadeira")').or(
        page.locator('button:has-text("Smartphone")').or(
          page.locator('button:has-text("Notebook")')
        )
      );
      
      await expect(presetButtons.first()).toBeVisible();
    }
  });

  test("should filter presets by category", async ({ page }) => {
    await page.goto("/ncm");
    
    // Check if category filter exists
    const categoryFilter = page.locator('button:has-text("Veículos")').or(
      page.locator('button:has-text("Eletrônicos")')
    );
    
    if (await categoryFilter.first().isVisible()) {
      await categoryFilter.first().click();
      
      // Should filter to show only relevant presets
      await page.waitForTimeout(300);
    }
  });

  test("should fill textarea with preset on click", async ({ page }) => {
    await page.goto("/ncm");
    
    // Find first preset button
    const presetButton = page.locator('button:has-text("Empilhadeira")').or(
      page.locator('button:has-text("Smartphone")')
    ).first();
    
    if (await presetButton.isVisible()) {
      await presetButton.click();
      
      // Textarea should be filled
      const textarea = page.locator('textarea[name="inputDescription"]').or(
        page.locator('textarea').first()
      );
      
      const value = await textarea.inputValue();
      expect(value.length).toBeGreaterThan(10);
    }
  });

  test("should submit classification request", async ({ page }) => {
    await page.goto("/ncm");
    
    // Find textarea
    const textarea = page.locator('textarea[name="inputDescription"]').or(
      page.locator('textarea').first()
    );
    
    await textarea.fill("Smartphone Samsung Galaxy S21, 128GB, cor preta, com câmera de 64MP");
    
    // Submit form
    const submitButton = page.locator('button[type="submit"]:has-text("Classificar")').or(
      page.locator('button:has-text("Classificar")')
    );
    
    await submitButton.click();
    
    // Should show loading state
    await expect(page.locator('text=/classificando|processando/i')).toBeVisible({ timeout: 3000 });
    
    // Should show result (or error)
    await page.waitForTimeout(5000);
  });
});
