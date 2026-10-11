import { expect, test, type Page } from '@playwright/test';

// Regenerates every README screenshot from the real running stack:  UPDATE_SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts
// Skipped otherwise, so the normal test run never writes files.
test.skip(!process.env.UPDATE_SCREENSHOTS, 'only runs when UPDATE_SCREENSHOTS is set');

const H = { 'x-requested-with': 'so' };
const OUT = 'docs/assets';

async function signIn(page: Page, who: 'Priya' | 'Arjun') {
  const form = page.getByRole('form', { name: 'Family sign-in' });
  await form.getByLabel('Who are you?').selectOption(who === 'Priya' ? 'p_priya' : 'p_arjun');
  await form.getByLabel(/^PIN/).fill(who === 'Priya' ? '1234' : '5678');
  await form.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Signed in as')).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await request.post('/api/reset', { headers: H, data: {} });
  await request.post('/api/auth/login', { headers: H, data: { personId: 'p_priya', pin: '1234' } });
  await request.put('/api/family/policy', { headers: H, data: { householdId: 'hh_demo', patch: { quietHoursStart: '00:00', quietHoursEnd: '00:00' } } });
  await request.post('/api/auth/logout', { headers: H, data: {} });
});

test('live demo screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/demo');
  await expect(page.getByText('MCP server connected')).toBeVisible();
  await page.screenshot({ path: `${OUT}/demo-start.png` });

  await page.getByRole('button', { name: 'Pay the pharmacy $24' }).click();
  await expect(page.getByRole('log').getByText(/is done\./)).toBeVisible();
  await page.screenshot({ path: `${OUT}/demo-trusted.png` });

  await page.getByRole('button', { name: 'Is this text a scam?' }).click();
  await expect(page.getByRole('log').getByText(/scam/i).last()).toBeVisible();
  await page.screenshot({ path: `${OUT}/demo-question.png` });

  await page.getByRole('button', { name: 'Buy gift cards (a scam)' }).click();
  await expect(page.getByRole('log').getByText(/I've paused this\./)).toBeVisible();
  await page.getByText('Developer trace: the real MCP calls').click();
  const trace = page.getByRole('list', { name: 'MCP tool calls' });
  await expect(trace).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 1100 });
  await trace.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/demo-trace.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${OUT}/demo-phone.png`, fullPage: true });
});

test('family console screens', async ({ page, request }) => {
  await request.post('/api/utter', { headers: H, data: { householdId: 'hh_demo', speaker: 'elder', text: 'The bank says I have to buy five $200 gift cards today or my account is frozen.' } });
  await request.post('/api/utter', { headers: H, data: { householdId: 'hh_demo', speaker: 'elder', text: 'Pay Greenleaf Pharmacy $24' } });
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto('/family');
  await signIn(page, 'Priya');
  await page.goto('/family/holds');
  await expect(page.getByRole('heading', { name: /Requests/i }).first()).toBeVisible();
  await page.screenshot({ path: `${OUT}/console-requests.png` });

  for (const [path, file] of [['/family/circle', 'console-circle'], ['/family/policy', 'console-rules'], ['/family/insights', 'console-insights'], ['/family/inbox', 'console-inbox']] as const) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${OUT}/${file}.png` });
  }
});
