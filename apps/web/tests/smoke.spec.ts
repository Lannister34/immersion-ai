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

test('redirects root to chats and hides unfinished sections from navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole('heading', { name: 'Создать чат' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Чаты' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'API' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Обзор' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Персонажи' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Лорбуки' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Сценарии' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Настройки' })).toHaveCount(0);
});

test('shows a focused external API panel without provider summary noise', async ({ page }) => {
  await page.goto('/server');

  await expect(page.getByRole('heading', { exact: true, name: 'API' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Внешний API' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Внешний API' })).toBeVisible();
  await expect(page.getByLabel('URL')).toHaveValue('http://127.0.0.1:6006');
  await expect(page.getByText('Сводка подключения')).toHaveCount(0);
  await expect(page.getByText(/каноничес/i)).toHaveCount(0);
});

test('persists external provider settings and restores them after reload', async ({ page }) => {
  await page.goto('/server');

  const urlInput = page.getByLabel('URL');
  await expect(urlInput).toHaveValue('http://127.0.0.1:6006');

  await urlInput.fill('http://127.0.0.1:6010');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Настройки внешнего API сохранены.')).toBeVisible();

  await page.reload();
  await expect(urlInput).toHaveValue('http://127.0.0.1:6010');
});

test('switches to builtin mode and exposes model launch controls', async ({ page }) => {
  await page.route('**/api/runtime/overview', async (route) => {
    await route.fulfill({
      json: {
        engine: {
          found: false,
          executablePath: null,
          defaultModelsDir: 'models',
        },
        serverStatus: {
          status: 'idle',
          model: null,
          modelPath: null,
          error: null,
          port: 5001,
          pid: null,
        },
        serverConfig: {
          modelsDirs: ['models'],
          port: 5001,
          gpuLayers: 99,
          contextSize: 16384,
          flashAttention: true,
          threads: 8,
        },
        models: [
          {
            name: 'nested/secondary.gguf',
            path: 'models/nested/secondary.gguf',
            size: 128,
            sourceDirectory: 'models',
          },
          {
            name: 'sandbox.gguf',
            path: 'models/sandbox.gguf',
            size: 128,
            sourceDirectory: 'models',
          },
        ],
      },
    });
  });

  await page.goto('/server');

  await page.getByRole('button', { name: 'Встроенный сервер' }).click();
  await expect(page.getByRole('button', { name: 'Встроенный сервер' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('sandbox.gguf')).toBeVisible();
  await expect(page.getByText('nested/secondary.gguf')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Запустить' }).first()).toBeVisible();
  await expect(page.getByText('llama-server не найден')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Установить' })).toBeVisible();
  await expect(page.getByText('KoboldCpp')).toHaveCount(0);
  await expect(page.getByText('Сводка подключения')).toHaveCount(0);
});

test('loads settings overview from backend route', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByRole('heading', { name: 'Текущая конфигурация профиля' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Пользователь и поведение' })).toBeVisible();
  await expect(page.getByText('Тестер')).toBeVisible();
});

test('shows a route-level not-found screen for unknown paths', async ({ page }) => {
  await page.goto('/missing-route');

  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  await expect(page.getByText('Проверьте адрес или вернитесь в доступные разделы приложения.')).toBeVisible();
});

test('creates a chat, opens it, and restores it after reload', async ({ page }) => {
  await page.route('**/api/generation/chat-reply', async (route) => {
    const body = route.request().postDataJSON() as {
      chatId: string;
      message: string;
    };
    const createdAt = new Date().toISOString();

    await route.fulfill({
      json: {
        session: {
          chat: {
            id: body.chatId,
            title: 'Smoke MVP chat',
            createdAt,
            updatedAt: createdAt,
            messageCount: 2,
            lastMessagePreview: 'Smoke assistant reply',
            characterName: null,
          },
          userName: 'Tester',
          characterName: null,
          messages: [
            {
              id: `${body.chatId}:1`,
              role: 'user',
              content: body.message,
              createdAt,
            },
            {
              id: `${body.chatId}:2`,
              role: 'assistant',
              content: 'Smoke assistant reply',
              createdAt,
            },
          ],
        },
      },
    });
  });

  await page.goto('/chat');

  await expect(page.getByRole('heading', { name: 'Создать чат' })).toBeVisible();
  await page.getByLabel('Название чата').fill('Smoke MVP chat');
  await page.getByRole('button', { name: 'Создать чат' }).click();

  await expect(page).toHaveURL(/\/chat\/[A-Za-z0-9_-]+$/);
  await expect(page.getByRole('heading', { name: 'Smoke MVP chat' })).toBeVisible();
  await expect(page.getByText('В этом чате пока нет сообщений.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Smoke MVP chat' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Сообщение' }).fill('Smoke user message');
  await page.getByRole('button', { name: 'Отправить' }).click();

  await expect(page.getByText('Smoke user message')).toBeVisible();
  await expect(page.getByText('Smoke assistant reply')).toBeVisible();

  await page.goto('/chat');
  await expect(page.getByRole('link', { name: /Smoke MVP chat/i })).toBeVisible();
});

test('blocks chat sending when generation readiness is blocked', async ({ page }) => {
  let generationRequestCount = 0;

  await page.route('**/api/generation/readiness', async (route) => {
    await route.fulfill({
      json: {
        activeProvider: 'custom',
        issue: {
          code: 'builtin_runtime_not_running',
          message: 'Встроенный сервер не запущен. Запустите модель на странице API.',
        },
        mode: 'builtin',
        runtime: {
          model: null,
          port: 5001,
          status: 'idle',
        },
        status: 'blocked',
      },
    });
  });

  await page.route('**/api/generation/chat-reply', async (route) => {
    generationRequestCount += 1;
    await route.fulfill({
      json: {
        code: 'unexpected_generation_call',
        message: 'Generation should stay blocked by readiness.',
      },
      status: 500,
    });
  });

  await page.goto('/chat');
  await page.getByLabel('Название чата').fill('Blocked generation chat');
  await page.getByRole('button', { name: 'Создать чат' }).click();

  await expect(page).toHaveURL(/\/chat\/[A-Za-z0-9_-]+$/);
  await expect(page.getByRole('heading', { name: 'Blocked generation chat' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Открыть API' })).toHaveCount(0);

  const messageInput = page.getByRole('textbox', { name: 'Сообщение' });
  await expect(messageInput).toBeEnabled();
  await messageInput.fill('Сообщение можно подготовить до запуска модели');

  const sendButton = page.getByRole('button', { name: 'Отправить' });
  await expect(sendButton).toBeDisabled();
  await expect(sendButton).toHaveAttribute('title', 'Встроенный сервер не запущен. Запустите модель на странице API.');
  expect(generationRequestCount).toBe(0);
});
