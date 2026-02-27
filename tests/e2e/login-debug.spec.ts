import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test('Debug: Medir tiempo de login', async ({ page }) => {
  // Ir a login
  await page.goto(`${BASE_URL}/login`);
  console.log('1. Página login cargada');

  // Llenar formulario
  await page.fill('input#email', 'demo@tradingbot.com');
  await page.fill('input#password', 'demo123');
  console.log('2. Formulario llenado');

  // Medir tiempo de login
  const startTime = Date.now();

  await page.click('button:has-text("Iniciar Sesion")');
  console.log('3. Botón clicado');

  // Esperar a que cambie la URL o aparezca error
  try {
    await page.waitForURL(/\/(dashboard|backtester)/, { timeout: 30000 });
    const endTime = Date.now();
    console.log(`✅ Login completado en ${(endTime - startTime) / 1000}s`);
    console.log(`   URL final: ${page.url()}`);
  } catch (e) {
    const endTime = Date.now();
    console.log(`❌ Timeout después de ${(endTime - startTime) / 1000}s`);
    console.log(`   URL actual: ${page.url()}`);

    // Buscar errores en la página
    const errorText = await page.locator('.bg-red-500, [class*="error"], [class*="Error"]').textContent().catch(() => 'No error found');
    console.log(`   Error en página: ${errorText}`);
  }

  // Screenshot final
  await page.screenshot({ path: 'tests/e2e/screenshots/debug-login.png', fullPage: true });
});

test('Debug: Verificar que la sesión se crea', async ({ page, context }) => {
  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input#email', 'demo@tradingbot.com');
  await page.fill('input#password', 'demo123');
  await page.click('button:has-text("Iniciar Sesion")');

  // Esperar un poco
  await page.waitForTimeout(3000);

  // Verificar cookies
  const cookies = await context.cookies();
  console.log('Cookies:', cookies.map(c => c.name).join(', '));

  // Verificar URL
  console.log('URL actual:', page.url());

  // Ir directamente a dashboard
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForTimeout(2000);
  console.log('URL después de ir a dashboard:', page.url());

  await page.screenshot({ path: 'tests/e2e/screenshots/debug-session.png', fullPage: true });
});
