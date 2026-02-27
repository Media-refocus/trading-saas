import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

// Credenciales de prueba
const TEST_EMAIL = "demo@backtester.com";
const TEST_PASSWORD = "Demo123456!";

test.describe("UI Review - Screenshots", () => {
  test.setTimeout(60000);

  // Función helper para login
  async function login(page: any) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector("#email", { timeout: 10000 });
    await page.fill("#email", TEST_EMAIL);
    await page.fill("#password", TEST_PASSWORD);
    await page.click('button[type="submit"]');
    // Esperar redirect
    await page.waitForURL(/\/(dashboard|backtester)/, { timeout: 15000 }).catch(async () => {
      // Si no redirige, intentar registrar
      await page.goto(`${BASE_URL}/register`);
      await page.waitForSelector("#email", { timeout: 10000 });
      await page.fill("#email", TEST_EMAIL);
      await page.fill("#password", TEST_PASSWORD);
      await page.fill("#name", "Demo User");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    });
  }

  test("01 - Landing/Home page", async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/01-home.png", fullPage: true });
  });

  test("02 - Login page", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/02-login.png", fullPage: true });
  });

  test("03 - Register page", async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/03-register.png", fullPage: true });
  });

  test("04 - Pricing page", async ({ page }) => {
    await page.goto(`${BASE_URL}/pricing`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/04-pricing.png", fullPage: true });
  });

  test("05 - Dashboard", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/05-dashboard.png", fullPage: true });
  });

  test("06 - Backtester - Vista principal", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/backtester`);
    await page.waitForLoadState("networkidle");
    // Esperar a que cargue el chart
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "screenshots/06-backtester.png", fullPage: true });
  });

  test("07 - Backtester - Panel de configuración", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/backtester`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    // Intentar abrir panel de configuración si existe
    const settingsBtn = page.locator('button:has-text("Config")').or(page.locator('[data-testid="settings-panel"]'));
    if (await settingsBtn.count() > 0) {
      await settingsBtn.first().click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: "screenshots/07-backtester-config.png", fullPage: true });
  });

  test("08 - Marketplace/Operativas", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/operativas`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/08-marketplace.png", fullPage: true });
  });

  test("09 - Settings", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/09-settings.png", fullPage: true });
  });

  test("10 - Bot Monitor", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/bot`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "screenshots/10-bot.png", fullPage: true });
  });
});
