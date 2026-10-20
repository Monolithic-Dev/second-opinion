import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test.use({
  video: { mode: 'on', size: { width: 1920, height: 1080 } },
  viewport: { width: 1920, height: 1080 },
});

test.setTimeout(240_000); // 4 minutes

const H = { 'x-requested-with': 'so' };
const VIDEO_DEST = 'scratch_audio/raw_video.webm';

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

test('record precisely timed video for audio synchronization', async ({ page, request }) => {
  await resetStack(request);

  // -------------------------------------------------------------------------
  // SCENE 1: Introduction on Landing Page (0.00s - 29.92s = ~30s)
  // -------------------------------------------------------------------------
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Zero-Trust Payment/i })).toBeVisible();
  await page.waitForTimeout(4_000);

  // Smooth scroll through landing page
  await page.evaluate(() => window.scrollBy({ top: 450, behavior: 'smooth' }));
  await page.waitForTimeout(6_000);
  await page.evaluate(() => window.scrollBy({ top: 550, behavior: 'smooth' }));
  await page.waitForTimeout(6_000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(4_000);

  // Navigate to live demo
  await page.getByRole('link', { name: 'Live demo' }).first().click();
  await expect(page.getByText('MCP server connected')).toBeVisible();
  await page.waitForTimeout(8_000); // Reaches ~30s total

  // -------------------------------------------------------------------------
  // SCENE 2: Dorothy's Echo & The Hero Scam Hold (30.0s - 59.4s = ~29.5s)
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Buy gift cards (a scam)' }).click();
  await expect(page.getByRole('log').getByText(/I've paused this\./)).toBeVisible();
  await page.waitForTimeout(27_000); // Reaches ~59.5s total

  // -------------------------------------------------------------------------
  // SCENE 3: Family Review & Denial (59.4s - 88.0s = ~28.6s)
  // -------------------------------------------------------------------------
  await signInAsPriya(page);
  await expect(page.getByText('1 waiting for you')).toBeVisible();
  await page.waitForTimeout(8_000);

  await page.getByRole('button', { name: 'Deny' }).click();
  await expect(page.getByRole('log').getByText("Your family said no, so I've cancelled it. You're safe.")).toBeVisible();
  await page.waitForTimeout(19_000); // Reaches ~88s total

  // -------------------------------------------------------------------------
  // SCENE 4: Frictionless Trusted Routine Payment (88.0s - 106.7s = ~18.7s)
  // -------------------------------------------------------------------------
  await page.getByRole('button', { name: 'Pay the pharmacy $24' }).click();
  await expect(page.getByRole('log').getByText(/is done\./)).toBeVisible();
  await page.waitForTimeout(17_500); // Reaches ~106.7s total

  // -------------------------------------------------------------------------
  // SCENE 5: Caregiver Family Console Tour (106.7s - 129.6s = ~22.9s)
  // -------------------------------------------------------------------------
  await page.goto('/family');
  const familyForm = page.getByRole('form', { name: 'Family sign-in' });
  if (await familyForm.isVisible()) {
    await familyForm.getByLabel('Who are you?').selectOption('p_priya');
    await familyForm.getByLabel(/^PIN/).fill('1234');
    await familyForm.getByRole('button', { name: 'Sign in' }).click();
  }
  await expect(page.getByText('Signed in as')).toBeVisible();
  await page.waitForTimeout(7_000); // Overview

  await page.goto('/family/policy');
  await page.waitForTimeout(7_000); // Rules

  await page.goto('/family/profile');
  await page.waitForTimeout(8_000); // Profile (Reaches ~129.6s total)

  // -------------------------------------------------------------------------
  // SCENE 6: Architecture & Developer Trace (129.6s - 158.0s = ~28.4s)
  // -------------------------------------------------------------------------
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Buy gift cards (a scam)' }).click();
  await page.getByText(/Developer trace/).click();
  const trace = page.getByRole('list', { name: 'MCP tool calls' });
  await expect(trace).toBeVisible();
  await trace.scrollIntoViewIfNeeded();
  await page.waitForTimeout(25_000); // Reaches ~158s total

  await page.close();

  const video = page.video();
  if (video) {
    const videoPath = await video.path();
    mkdirSync(dirname(VIDEO_DEST), { recursive: true });
    copyFileSync(videoPath, VIDEO_DEST);
  }
});
