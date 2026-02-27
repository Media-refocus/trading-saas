import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test('Debug: Intercept login API call', async ({ page }) => {
  // Interceptar todas las llamadas a auth
  const authRequests: any[] = [];

  page.on('request', request => {
    if (request.url().includes('/api/auth')) {
      console.log('📤 Request:', request.method(), request.url());
      authRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData()
      });
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/auth')) {
      console.log('📥 Response:', response.status(), response.url());

      // Intentar leer el cuerpo
      try {
        const body = await response.text();
        console.log('   Body preview:', body.substring(0, 200));

        // Log headers
        const headers = response.headers();
        console.log('   Set-Cookie:', headers['set-cookie']?.substring(0, 100) || 'none');
      } catch (e) {
        console.log('   Could not read body');
      }
    }
  });

  // Console logs de la página
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('result')) {
      console.log('🖥️ Console:', msg.type(), msg.text());
    }
  });

  // Ir a login y hacer submit
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input#email', 'demo@tradingbot.com');
  await page.fill('input#password', 'demo123');

  console.log('\n🔄 Haciendo click en login...\n');
  await page.click('button:has-text("Iniciar Sesion")');

  // Esperar a que termine la petición
  await page.waitForTimeout(5000);

  console.log('\n📊 URL final:', page.url());
  console.log('📊 Auth requests capturados:', authRequests.length);

  // Buscar si hay error visible
  const errorDiv = await page.locator('.bg-red-500, [class*="error"]').isVisible();
  console.log('📊 Error visible:', errorDiv);

  // Screenshot
  await page.screenshot({ path: 'tests/e2e/screenshots/debug-intercept.png', fullPage: true });
});

test('Debug: Login manual sin redirect', async ({ page }) => {
  // Primero obtener CSRF token
  await page.goto(`${BASE_URL}/api/auth/csrf`);
  const csrfData = await page.evaluate(() => document.body.textContent);
  console.log('CSRF response:', csrfData?.substring(0, 200));

  // Parsear CSRF
  let csrfToken = '';
  try {
    const parsed = JSON.parse(csrfData || '{}');
    csrfToken = parsed.csrfToken || '';
  } catch (e) {}

  console.log('CSRF Token:', csrfToken);

  // Hacer login directamente
  const response = await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: {
      email: 'demo@tradingbot.com',
      password: 'demo123',
      csrfToken: csrfToken,
      callbackUrl: `${BASE_URL}/dashboard`,
      json: 'true'
    },
    maxRedirects: 0
  });

  console.log('\n📊 Login response status:', response.status());
  console.log('📊 Login response headers:', JSON.stringify(response.headers(), null, 2));

  const body = await response.text();
  console.log('📊 Login response body:', body.substring(0, 500));
});
