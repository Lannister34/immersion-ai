import fs from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

import { expect, test } from '@playwright/test';

const smokeUserSettingsPath = fileURLToPath(
  new URL('../../api/testdata/smoke-data/user-settings.json', import.meta.url),
);
const smokeChatsPath = fileURLToPath(new URL('../../api/testdata/smoke-data/chats', import.meta.url));

let baselineUserSettings = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  baselineUserSettings = await fs.readFile(smokeUserSettingsPath, 'utf8');
});

test.afterEach(async () => {
  await fs.writeFile(smokeUserSettingsPath, baselineUserSettings, 'utf8');
  await fs.rm(smokeChatsPath, { recursive: true, force: true });
});

test('loads canonical overview screens from backend routes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Основа переписывания Immersion AI' })).toBeVisible();

  await page.getByRole('link', { name: 'Настройки' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Пользователь и поведение' })).toBeVisible();

  await page.getByRole('link', { name: 'Сервер' }).click();
  await expect(page).toHaveURL(/\/server$/);
  await expect(page.getByRole('heading', { name: 'Сервер и провайдеры' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Режим провайдера и подключение' })).toBeVisible();
  await expect(page.getByLabel('URL')).toHaveValue('http://127.0.0.1:6006');
});

test('persists external provider settings and restores them after reload', async ({ page }) => {
  await page.goto('/server');

  const urlInput = page.getByLabel('URL');
  await expect(urlInput).toHaveValue('http://127.0.0.1:6006');

  await urlInput.fill('http://127.0.0.1:6010');
  await page.getByRole('button', { name: 'Сохранить конфигурацию' }).click();
  await expect(page.getByText('Каноническая конфигурация провайдера сохранена.')).toBeVisible();

  await page.reload();
  await expect(urlInput).toHaveValue('http://127.0.0.1:6010');
});

test('switches to builtin mode and keeps runtime panel as placeholder', async ({ page }) => {
  await page.goto('/server');

  await page.getByRole('button', { name: 'Встроенный' }).click();
  await page.getByRole('button', { name: 'Сохранить конфигурацию' }).click();
  await expect(page.getByText('Каноническая конфигурация провайдера сохранена.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Встроенный' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Сейчас builtin mode уже сохраняется канонически')).toBeVisible();
});

test('shows a route-level not-found screen for unknown paths', async ({ page }) => {
  await page.goto('/missing-route');

  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  await expect(page.getByText('Маршрут не существует в текущем rewrite-shell.')).toBeVisible();
});

test('creates a chat, opens it, and restores it after reload', async ({ page }) => {
  await page.goto('/chat');

  await expect(page.getByRole('heading', { name: 'Создать новый чат' })).toBeVisible();
  await page.getByLabel('Название чата').fill('Smoke MVP chat');
  await page.getByRole('button', { name: 'Создать чат' }).click();

  await expect(page).toHaveURL(/\/chat\/[A-Za-z0-9_-]+$/);
  await expect(page.getByRole('heading', { name: 'Smoke MVP chat' })).toBeVisible();
  await expect(page.getByText('Сообщений пока нет. Этот чат уже существует на диске')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Smoke MVP chat' })).toBeVisible();

  await page.goto('/chat');
  await expect(page.getByRole('link', { name: /Smoke MVP chat/i })).toBeVisible();
});
