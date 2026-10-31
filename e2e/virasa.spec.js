import { expect, test } from '@playwright/test';

test('visitor can browse and verify a heritage record', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /collection/i }).first().click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.getByRole('main')).toBeVisible();
  await page.goto('/verify');
  await expect(page.getByRole('heading', { name: /trace the mark/i })).toBeVisible();
});

test('administrator can sign in, search, and edit a product revision', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/^email$/i).fill('admin@virasa.in');
  await page.getByLabel(/^password$/i).fill('admin-virasa-2026');
  await page.getByRole('button', { name: /sign in to the archive/i }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole('heading', { name: /maintain the archive/i })).toBeVisible();
  await page.getByLabel('Search registry').fill('Madhubani');
  await expect(page.getByRole('link', { name: /Krishna Leela/i })).toBeVisible();
  await page.getByRole('button', { name: /^edit$/i }).first().click();
  await page.getByLabel(/^correction reason/i).fill('E2E verification of the admin correction workflow');
  await page.getByRole('button', { name: /save revision/i }).click();
  await expect(page.getByText(/revision was appended/i)).toBeVisible();
});

test('password recovery does not disclose whether an account exists', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /forgot password/i }).click();
  await page.getByLabel(/^email$/i).fill('unknown@example.com');
  await page.getByRole('button', { name: /send reset link/i }).click();
  await expect(page.getByRole('status')).toContainText('If that account exists');
});
