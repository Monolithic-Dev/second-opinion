import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const H = { 'x-requested-with': 'so' };
const HERO = 'The bank says I have to buy five $200 gift cards today or my account is frozen.';

/** Wipe and re-seed, and turn quiet hours off so the result does not depend on the time of day the test runs. */
async function resetStack(request: APIRequestContext) {
  expect((await request.post('/api/reset', { headers: H, data: {} })).ok()).toBeTruthy();
  expect((await request.post('/api/auth/login', { headers: H, data: { personId: 'p_priya', pin: '1234' } })).ok()).toBeTruthy();
  expect((await request.put('/api/family/policy', { headers: H, data: { householdId: 'hh_demo', patch: { quietHoursStart: '00:00', quietHoursEnd: '00:00' } } })).ok()).toBeTruthy();
  await request.post('/api/auth/logout', { headers: H, data: {} });
}

async function signIn(page: Page, who: 'Priya' | 'Arjun') {
  const form = page.getByRole('form', { name: 'Family sign-in' });
  await form.getByLabel('Who are you?').selectOption(who === 'Priya' ? 'p_priya' : 'p_arjun');
  await form.getByLabel(/^PIN/).fill(who === 'Priya' ? '1234' : '5678');
  await form.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(`Signed in as`)).toBeVisible();
}

async function holdHero(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/utter', { headers: H, data: { householdId: 'hh_demo', speaker: 'elder', text: HERO } });
  const body = (await res.json()) as { holdId: string };
  expect(body.holdId).toMatch(/^hold_/);
  return body.holdId;
}

test.beforeEach(async ({ request }) => {
  await resetStack(request);
});

test('the console is closed to anyone who has not signed in', async ({ page }) => {
  await page.goto('/family');
  await expect(page.getByRole('form', { name: 'Family sign-in' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Family console' })).toHaveCount(0);
  const form = page.getByRole('form', { name: 'Family sign-in' });
  await form.getByLabel(/^PIN/).fill('0000');
  await form.getByRole('button', { name: 'Sign in' }).click();
  await expect(form.getByRole('alert')).toHaveText('Wrong PIN.');
});

test('overview: all clear, then one request needs a decision', async ({ page, request }) => {
  await page.goto('/family');
  await signIn(page, 'Priya');
  await expect(page.getByText(/Dorothy is protected/)).toBeVisible();
  await holdHero(request);
  await expect(page.getByText('1 request needs your decision')).toBeVisible(); // live update, no reload
  await expect(page.getByRole('link', { name: 'Purchase of $1,000 to gift cards' }).first()).toBeVisible();
  await page.screenshot({ path: 'docs/assets/console-overview.png' });
});

test('two approvers: one approval keeps it waiting, the second (a different person) releases it', async ({ page, request }) => {
  await page.goto('/family');
  await signIn(page, 'Priya');

  await page.getByRole('link', { name: 'Rules' }).click();
  await page.getByLabel('Approvals needed').selectOption('2');
  await page.getByRole('button', { name: 'Save rules' }).click();
  await expect(page.getByText(/Saved: 1 rule changed/)).toBeVisible();

  const holdId = await holdHero(request);
  await page.goto(`/family/holds/${holdId}`);
  await expect(page.getByText('0 of 2 approvals')).toBeVisible();
  await page.getByPlaceholder('Add a note (optional)').fill('Looks like my own purchase');
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('1 of 2 approvals')).toBeVisible();
  await expect(page.getByText('Priya', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Waiting for the other approver/)).toBeVisible();
  await page.screenshot({ path: 'docs/assets/console-detail.png' });

  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, 'Arjun');
  await page.goto(`/family/holds/${holdId}`);
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('This request is closed.')).toBeVisible();
  await expect(page.getByText('2 of 2 approvals')).toBeVisible();
  await expect(page.getByText('Decision made (released)')).toBeVisible();

  await page.getByRole('link', { name: 'Notifications' }).click();
  await expect(page.getByText('Decision made').first()).toBeVisible();
  await expect(page.getByText('Email (file)').first()).toBeVisible();
});

test('a single deny vetoes even when another approver approved', async ({ page, request }) => {
  await page.goto('/family');
  await signIn(page, 'Priya');
  await page.getByRole('link', { name: 'Rules' }).click();
  await page.getByLabel('Approvals needed').selectOption('2');
  await page.getByRole('button', { name: 'Save rules' }).click();
  await expect(page.getByText(/Saved/)).toBeVisible();
  const holdId = await holdHero(request);
  await page.goto(`/family/holds/${holdId}`);
  await page.getByRole('button', { name: 'Deny' }).click();
  await expect(page.getByText('Declined').first()).toBeVisible();
  await expect(page.getByText('This request is closed.')).toBeVisible();
});

test('rules: invalid values are caught before saving; valid ones save and persist', async ({ page }) => {
  await page.goto('/family/policy');
  await signIn(page, 'Priya');
  const max = page.getByLabel(/Single payment limit/);
  const save = page.getByRole('button', { name: 'Save rules' });
  await expect(save).toBeDisabled();
  await max.fill('3');
  await expect(page.getByText(/between 10 and 50,000/)).toBeVisible();
  await expect(save).toBeDisabled();
  await max.fill('650');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText(/Saved: 1 rule changed/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/Single payment limit/)).toHaveValue('650');
});

test('trusted payees can be added and removed', async ({ page }) => {
  await page.goto('/family/circle');
  await signIn(page, 'Priya');
  await expect(page.getByText('greenleaf pharmacy')).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('Corner Bakery');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'corner bakery', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove corner bakery' }).click();
  await expect(page.getByRole('cell', { name: 'corner bakery', exact: true })).toHaveCount(0);
});

test('insights show protected dollars after a denied scam', async ({ page, request }) => {
  const holdId = await holdHero(request);
  await page.goto(`/family/holds/${holdId}`);
  await signIn(page, 'Priya');
  await page.getByRole('button', { name: 'Deny' }).click();
  await expect(page.getByText('This request is closed.')).toBeVisible();
  await page.getByRole('link', { name: 'Insights' }).click();
  await expect(page.getByText('$2,000')).toBeVisible(); // the seeded $1,000 denial plus this one
  await expect(page.getByText('Gift cards')).toBeVisible();
});

test('accessibility: no serious or critical axe violations across the console', async ({ page, request }) => {
  const holdId = await holdHero(request);
  await page.goto('/family');
  await signIn(page, 'Priya');
  const pages = ['/family', '/family/holds', `/family/holds/${holdId}`, '/family/circle', '/family/policy', '/family/insights', '/family/inbox'];
  for (const path of pages) {
    await page.getByRole('link', { name: /Family console/ }).first().click().catch(() => undefined);
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Family console' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), path).toEqual([]);
  }
});

test('the console works at phone width without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/family');
  await signIn(page, 'Priya');
  for (const path of ['/family', '/family/holds', '/family/policy', '/family/circle']) {
    await page.goto(path);
    await expect(page.getByRole('navigation', { name: 'Family console' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
