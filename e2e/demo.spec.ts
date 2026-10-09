import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const H = { 'x-requested-with': 'so' };

/** Wipe and re-seed, and turn quiet hours off so the result does not depend on the time of day the test runs. */
async function resetStack(request: APIRequestContext) {
  expect((await request.post('/api/reset', { headers: H, data: {} })).ok()).toBeTruthy();
  const login = await request.post('/api/auth/login', { headers: H, data: { personId: 'p_priya', pin: '1234' } });
  expect(login.ok()).toBeTruthy();
  const put = await request.put('/api/family/policy', { headers: H, data: { householdId: 'hh_demo', patch: { quietHoursStart: '00:00', quietHoursEnd: '00:00' } } });
  expect(put.ok()).toBeTruthy();
  await request.post('/api/auth/logout', { headers: H, data: {} });
}

async function signInAsPriya(page: Page) {
  const form = page.getByRole('form', { name: 'Family sign-in' });
  await form.getByLabel('Who are you?').selectOption('p_priya');
  await form.getByLabel(/^PIN/).fill('1234');
  await form.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText("Priya's phone")).toBeVisible();
}

test.beforeEach(async ({ request, page }) => {
  await resetStack(request);
  await page.goto('/demo');
  await expect(page.getByText('MCP server connected')).toBeVisible();
});

test('hero flow: a scam payment request is paused, the family denies it, Dorothy is told live', async ({ page }) => {
  const log = page.getByRole('log', { name: 'Conversation' });
  await page.getByRole('button', { name: 'Buy gift cards (a scam)' }).click();

  await expect(log.getByText(/I've paused this\./)).toBeVisible();
  await expect(log.getByText(/I've asked Priya to check\./)).toBeVisible();
  await expect(log.getByText('Held: possible scam')).toBeVisible();
  await expect(log.getByText('Asks for gift cards')).toBeVisible();
  await expect(log.getByText(/same kind of request as/)).toBeVisible();

  await signInAsPriya(page);
  await expect(page.getByText('1 waiting for you')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Purchase of $1,000 to gift cards' })).toBeVisible();

  if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: 'docs/assets/demo-held.png' });
  await page.getByRole('button', { name: 'Deny' }).click();
  await expect(log.getByText("Your family said no, so I've cancelled it. You're safe.")).toBeVisible();
  await expect(page.getByText('Nothing needs your attention')).toBeVisible();
  if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: 'docs/assets/demo-denied.png' });
});

test('a routine payment to a trusted payee goes through without a hold', async ({ page }) => {
  await page.getByRole('button', { name: 'Pay the pharmacy $24' }).click();
  await expect(page.getByRole('log').getByText(/is done\./)).toBeVisible();
  await signInAsPriya(page);
  await expect(page.getByText('All clear')).toBeVisible();
});

test('Dorothy cannot approve her own request', async ({ page }) => {
  await page.getByRole('button', { name: 'Buy gift cards (a scam)' }).click();
  await expect(page.getByText(/I've asked Priya to check\./)).toBeVisible();
  await page.getByRole('button', { name: 'Try to approve it myself' }).click();
  await expect(page.getByText(/Only a family member can approve that/)).toBeVisible();
  await signInAsPriya(page);
  await expect(page.getByText('1 waiting for you')).toBeVisible();
});

test('the developer trace proves the real MCP server did the checking', async ({ page }) => {
  await page.getByRole('button', { name: 'Buy gift cards (a scam)' }).click();
  await expect(page.getByText(/I've asked Priya to check\./)).toBeVisible();
  await page.getByText(/Developer trace/).click();
  const trace = page.getByRole('list', { name: 'MCP tool calls' });
  for (const tool of ['check_message', 'place_hold', 'request_family_approval']) await expect(trace.getByText(tool, { exact: true })).toBeVisible();
});

test('a scam question gets a plain answer and no hold', async ({ page }) => {
  await page.getByRole('button', { name: 'Is this text a scam?' }).click();
  await expect(page.getByRole('log').getByText(/scam|risky/i).first()).toBeVisible();
  await signInAsPriya(page);
  await expect(page.getByText('All clear')).toBeVisible();
});

test('reset restores the demo', async ({ page }) => {
  await page.getByRole('button', { name: 'Pay the pharmacy $24' }).click();
  await expect(page.getByRole('log').getByText(/is done\./)).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('Press the microphone, type, or tap an example below.')).toBeVisible();
});

test('accessibility: no serious or critical axe violations on the demo', async ({ page }) => {
  await page.getByRole('button', { name: 'Buy gift cards (a scam)' }).click();
  await expect(page.getByText(/I've asked Priya to check\./)).toBeVisible();
  await signInAsPriya(page);
  await expect(page.getByText('1 waiting for you')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

test('the page works at phone width without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/demo');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
