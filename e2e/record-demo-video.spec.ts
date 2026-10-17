import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test.use({
  video: { mode: 'on', size: { width: 1920, height: 1080 } },
  viewport: { width: 1920, height: 1080 },
});

test.setTimeout(240_000); // 4 minutes

const H = { 'x-requested-with': 'so' };
const VIDEO_DEST = 'docs/assets/demo-video-for-audio.webm';

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
  if (await form.isVisible()) {
    await form.getByLabel('Who are you?').selectOption('p_priya');
    await form.getByLabel(/^PIN/).fill('1234');
    await form.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText("Priya's phone")).toBeVisible();
  }
}

test('record 2m45s demo walkthrough video for voiceover', async ({ page, request }) => {
  await resetStack(request);

  // -------------------------------------------------------------------------
  // 1. (0:00 - 0:20) Introduction screen
  // -------------------------------------------------------------------------
  await page.goto('/demo');
  await expect(page.getByText('MCP server connected')).toBeVisible();
  await page.waitForTimeout(18_000);

  // -------------------------------------------------------------------------
  // 2. (0:20 - 0:50) Hero moment: Gift card scam held
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Buy gift cards (a scam)' }).click();
  await expect(page.getByRole('log').getByText(/I've paused this\./)).toBeVisible();
  await page.waitForTimeout(25_000);

  // -------------------------------------------------------------------------
  // 3. (0:50 - 1:25) Family phone approval & denial
  // -------------------------------------------------------------------------
  await signInAsPriya(page);
  await expect(page.getByText('1 waiting for you')).toBeVisible();
  await page.waitForTimeout(10_000);

  await page.getByRole('button', { name: 'Deny' }).click();
  await expect(page.getByRole('log').getByText("Your family said no, so I've cancelled it. You're safe.")).toBeVisible();
  await page.waitForTimeout(20_000);

  // -------------------------------------------------------------------------
  // 4. (1:25 - 1:50) Ordinary trusted payment (no friction)
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Pay the pharmacy $24' }).click();
  await expect(page.getByRole('log').getByText(/is done\./)).toBeVisible();
  await page.waitForTimeout(22_000);

  // -------------------------------------------------------------------------
  // 5. (1:50 - 2:20) Family Console tour
  // -------------------------------------------------------------------------
  await page.goto('/family');
  const familyForm = page.getByRole('form', { name: 'Family sign-in' });
  if (await familyForm.isVisible()) {
    await familyForm.getByLabel('Who are you?').selectOption('p_priya');
    await familyForm.getByLabel(/^PIN/).fill('1234');
    await familyForm.getByRole('button', { name: 'Sign in' }).click();
  }
  await expect(page.getByText('Signed in as')).toBeVisible();
  await page.waitForTimeout(10_000); // Overview

  await page.goto('/family/rules');
  await page.waitForTimeout(12_000); // Rules

  await page.goto('/family/people');
  await page.waitForTimeout(10_000); // Family & payees

  // -------------------------------------------------------------------------
  // 6. (2:20 - 2:45) Return to Demo and Developer trace (MCP calls)
  // -------------------------------------------------------------------------
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Buy gift cards (a scam)' }).click();
  await page.getByText(/Developer trace/).click();
  const trace = page.getByRole('list', { name: 'MCP tool calls' });
  await expect(trace).toBeVisible();
  await trace.scrollIntoViewIfNeeded();
  await page.waitForTimeout(22_000);

  // End of recording
  await page.close();

  // Save the video to docs/assets/demo-video-for-audio.webm
  const video = page.video();
  if (video) {
    const videoPath = await video.path();
    mkdirSync(dirname(VIDEO_DEST), { recursive: true });
    copyFileSync(videoPath, VIDEO_DEST);
  }
});
