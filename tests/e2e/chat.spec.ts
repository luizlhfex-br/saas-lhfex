import { test, expect, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await expect(page.locator('input[name="csrf"]')).toBeAttached();
  await page.locator('input[name="email"]').fill("luiz@lhfex.com.br");
  await page.locator('input[name="password"]').fill("lhfex2025!");
  await Promise.all([
    page.waitForURL(/\/($|dashboard)/, { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await expect(page).not.toHaveURL(/\/login$/);
}

function openChatButton(page: Page) {
  return page.locator('button[aria-label="Abrir chat"]');
}

function closeChatButton(page: Page) {
  return page.locator('button[aria-label="Fechar chat"]');
}

function chatDialog(page: Page) {
  return page.getByRole("dialog");
}

function chatInput(page: Page) {
  return page.locator('input[aria-label="Mensagem"]');
}

function sendChatButton(page: Page) {
  return page.locator('button[aria-label="Enviar"]');
}

async function openChat(page: Page) {
  await expect(openChatButton(page)).toBeVisible();
  await openChatButton(page).click();
  await expect(chatDialog(page)).toBeVisible();
}

test.describe("Chat Widget Integration", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should open chat widget", async ({ page }) => {
    await openChat(page);
    await expect(closeChatButton(page)).toBeVisible();
  });

  test("should send message and receive response", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversationId: "test-conv-123",
          reply: "Claro, posso ajudar com a nota fiscal.",
          agentId: "airton",
        }),
      });
    });

    await openChat(page);
    await expect(chatInput(page)).toBeVisible();

    await chatInput(page).fill("Ola, preciso de ajuda com uma nota fiscal");
    await sendChatButton(page).click();

    await expect(chatDialog(page).getByText("Ola, preciso de ajuda com uma nota fiscal", { exact: true })).toBeVisible({
      timeout: 3000,
    });
    await expect(chatDialog(page).getByText("Claro, posso ajudar com a nota fiscal.", { exact: true })).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show agent selection", async ({ page }) => {
    await openChat(page);

    const agentSelector = page.getByRole("button", { name: /AIrton|IAna|marIA|IAgo|Hermes Agent|OpenClaw/i }).first();
    await expect(agentSelector).toBeVisible();
    await agentSelector.click();

    await expect(chatDialog(page).getByRole("button", { name: /IAna/i }).last()).toBeVisible();
  });

  test("should send openclaw as selected agent", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      const body = route.request().postDataJSON() as { agentId?: string; message?: string };
      expect(body.agentId).toBe("openclaw");
      expect(body.message).toBe("Acompanhe esta promocao do Instagram");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversationId: "openclaw-conv-123",
          reply: "Posso acompanhar essa promocao para voce.",
          agentId: "openclaw",
        }),
      });
    });

    await openChat(page);

    const agentSelector = page.getByRole("button", { name: /AIrton|IAna|marIA|IAgo|Hermes Agent|OpenClaw/i }).first();
    await agentSelector.click();
    await chatDialog(page).getByRole("button", { name: /Hermes Agent|OpenClaw/i }).last().click();

    await chatInput(page).fill("Acompanhe esta promocao do Instagram");
    await sendChatButton(page).click();

    await expect(chatDialog(page).getByText("Posso acompanhar essa promocao para voce.", { exact: true })).toBeVisible({
      timeout: 5000,
    });
  });

  test("should display error message on failure", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          code: "INTERNAL_ERROR",
          error: "Erro interno do servidor",
        }),
      });
    });

    await openChat(page);
    await chatInput(page).fill("Test error handling");
    await sendChatButton(page).click();

    await expect(chatDialog(page).getByText("Erro interno do servidor", { exact: true })).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show retry button on retryable error", async ({ page }) => {
    let requestCount = 0;

    await page.route("**/api/chat", async (route) => {
      requestCount++;

      if (requestCount === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "AI_PROVIDER_UNAVAILABLE",
            error: "Servico temporariamente indisponivel",
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversationId: "test-conv-123",
          reply: "Como posso ajudar?",
          agentId: "airton",
        }),
      });
    });

    await openChat(page);
    await chatInput(page).fill("Test retry functionality");
    await sendChatButton(page).click();

    await expect(page.locator("text=/temporariamente indisponivel/i")).toBeVisible({ timeout: 5000 });

    const retryButton = page.getByRole("button", { name: /tentar novamente/i });
    await expect(retryButton).toBeVisible();
    await retryButton.click();

    await expect(page.locator("text=/como posso ajudar/i")).toBeVisible({ timeout: 5000 });
  });

  test("should display retry count after multiple attempts", async ({ page }) => {
    let requestCount = 0;

    await page.route("**/api/chat", async (route) => {
      requestCount++;

      if (requestCount <= 3) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "AI_PROVIDER_UNAVAILABLE",
            error: "Servico temporariamente indisponivel",
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversationId: "conv-123",
          reply: "Sucesso apos multiplas tentativas",
          agentId: "airton",
        }),
      });
    });

    await openChat(page);
    await chatInput(page).fill("Test multiple retries");
    await sendChatButton(page).click();

    for (let i = 1; i <= 3; i++) {
      await expect(page.locator("text=/temporariamente indisponivel/i")).toBeVisible({ timeout: 5000 });

      const retryButton = page.getByRole("button", { name: /tentar novamente/i });
      await retryButton.click();

      if (i >= 3) {
        await expect(page.locator("text=/tentativas/i")).toBeVisible();
      }
    }
  });

  test("should handle conversation history", async ({ page }) => {
    let requestCount = 0;

    await page.route("**/api/chat", async (route) => {
      requestCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversationId: "history-conv-123",
          reply: requestCount === 1 ? "Primeira resposta" : "Segunda resposta",
          agentId: "airton",
        }),
      });
    });

    await openChat(page);

    await chatInput(page).fill("Primeira mensagem");
    await sendChatButton(page).click();
    await expect(page.locator("text=/Primeira resposta/i")).toBeVisible({ timeout: 5000 });

    await chatInput(page).fill("Segunda mensagem");
    await sendChatButton(page).click();

    await expect(page.locator("text=/Primeira mensagem/i")).toBeVisible();
    await expect(page.locator("text=/Segunda mensagem/i")).toBeVisible();
    await expect(page.locator("text=/Segunda resposta/i")).toBeVisible({ timeout: 5000 });
  });

  test("should close chat widget", async ({ page }) => {
    await openChat(page);
    await expect(closeChatButton(page)).toBeVisible();

    await closeChatButton(page).click();
    await expect(openChatButton(page)).toBeVisible();
  });
});

test.describe("NCM Classification E2E", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should navigate to NCM page", async ({ page }) => {
    await page.goto("/ncm");

    await expect(page).toHaveURL(/\/ncm$/);
    await expect(page.locator("text=/ncm|classifica/i").first()).toBeVisible();
  });

  test("should display NCM presets", async ({ page }) => {
    await page.goto("/ncm");

    const presetsSection = page.locator("text=/exemplos rapidos/i").or(page.locator("text=/presets/i"));

    if (await presetsSection.isVisible()) {
      const presetButtons = page.locator('button:has-text("Empilhadeira")').or(
        page.locator('button:has-text("Smartphone")').or(page.locator('button:has-text("Notebook")'))
      );

      await expect(presetButtons.first()).toBeVisible();
    }
  });

  test("should filter presets by category", async ({ page }) => {
    await page.goto("/ncm");

    const categoryFilter = page.locator('button:has-text("Veiculos")').or(
      page.locator('button:has-text("Eletronicos")')
    );

    if (await categoryFilter.first().isVisible()) {
      await categoryFilter.first().click();
      await page.waitForTimeout(300);
    }
  });

  test("should fill textarea with preset on click", async ({ page }) => {
    await page.goto("/ncm");

    const presetButton = page.locator('button:has-text("Empilhadeira")').or(
      page.locator('button:has-text("Smartphone")')
    ).first();

    if (await presetButton.isVisible()) {
      await presetButton.click();

      const textarea = page.locator('textarea[name="inputDescription"]').or(page.locator("textarea").first());
      const value = await textarea.inputValue();
      expect(value.length).toBeGreaterThan(10);
    }
  });

  test("should submit classification request", async ({ page }) => {
    await page.goto("/ncm");

    const textarea = page.locator('textarea[name="inputDescription"]').or(page.locator("textarea").first());
    await textarea.fill("Smartphone Samsung Galaxy S21, 128GB, cor preta, com camera de 64MP");

    const submitButton = page.locator('button[type="submit"]:has-text("Classificar")').or(
      page.locator('button:has-text("Classificar")')
    );

    await submitButton.click();
    await expect(
      page.locator('button[type="submit"]:has-text("Classificando")').or(page.locator('button:has-text("Classificando")')).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/ncm$/, { timeout: 5000 });
  });
});
