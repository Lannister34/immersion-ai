import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const smokeDataRoot = process.env.IMMERSION_SMOKE_DATA_ROOT;

if (!smokeDataRoot) {
  throw new Error('IMMERSION_SMOKE_DATA_ROOT must point to an isolated smoke-test data directory.');
}

const smokeUserSettingsPath = path.join(smokeDataRoot, 'user-settings.json');
const smokeChatsPath = path.join(smokeDataRoot, 'chats');

let baselineUserSettings = '';

test.describe.configure({ mode: 'serial' });

async function resetSmokeData() {
  await fs.writeFile(smokeUserSettingsPath, baselineUserSettings, 'utf8');
  await fs.rm(smokeChatsPath, { recursive: true, force: true });
}

test.beforeAll(async () => {
  baselineUserSettings = await fs.readFile(smokeUserSettingsPath, 'utf8');
});

test.beforeEach(resetSmokeData);

test.afterEach(resetSmokeData);

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
  await expect(page.getByLabel('Модель')).toHaveValue('local-model');
  await expect(page.getByText('Сводка подключения')).toHaveCount(0);
  await expect(page.getByText(/каноничес/i)).toHaveCount(0);
});

test('persists external provider settings and restores them after reload', async ({ page }) => {
  await page.goto('/server');

  const urlInput = page.getByLabel('URL');
  const modelInput = page.getByLabel('Модель');
  await expect(urlInput).toHaveValue('http://127.0.0.1:6006');
  await expect(modelInput).toHaveValue('local-model');

  await urlInput.fill('http://127.0.0.1:6010');
  await modelInput.fill('lm-studio-model');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Настройки внешнего API сохранены.')).toBeVisible();

  await page.reload();
  await expect(urlInput).toHaveValue('http://127.0.0.1:6010');
  await expect(modelInput).toHaveValue('lm-studio-model');
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

  const saveModeResponse = page.waitForResponse((response) => {
    return response.url().includes('/api/providers/settings') && response.request().method() === 'PUT';
  });

  await page.getByRole('button', { name: 'Встроенный сервер' }).click();
  await expect(page.getByRole('button', { name: 'Встроенный сервер' })).toHaveAttribute('aria-pressed', 'true');
  await saveModeResponse;
  await expect(page.getByText('sandbox.gguf')).toBeVisible();
  await expect(page.getByText('nested/secondary.gguf')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Запустить' }).first()).toBeVisible();
  await expect(page.getByText('llama-server не найден')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Установить' })).toBeVisible();
  await expect(page.getByText('KoboldCpp')).toHaveCount(0);
  await expect(page.getByText('Сводка подключения')).toHaveCount(0);
});

test('shows a single loaded runtime model state without duplicate launch status', async ({ page }) => {
  await page.route('**/api/runtime/overview', async (route) => {
    await route.fulfill({
      json: {
        engine: {
          found: true,
          executablePath: 'bin/llama-server.exe',
          defaultModelsDir: 'models',
        },
        serverStatus: {
          status: 'running',
          model: 'sandbox.gguf',
          modelPath: 'models/sandbox.gguf',
          error: null,
          port: 5001,
          pid: 2780,
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
  await expect(page.getByText('Текущая модель')).toHaveCount(0);
  await expect(page.getByText(/Запускаем/)).toHaveCount(0);

  const loadedModelRow = page.locator('.model-row--current').filter({ hasText: 'sandbox.gguf' });
  await expect(loadedModelRow).toBeVisible();
  await expect(loadedModelRow.getByText('Загружена')).toBeVisible();
  await expect(loadedModelRow.getByRole('button', { name: 'Запустить' })).toHaveCount(0);

  const secondaryModelRow = page.locator('.model-row').filter({ hasText: 'nested/secondary.gguf' });
  await expect(secondaryModelRow.getByRole('button', { name: 'Запустить' })).toBeEnabled();
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
  await page.route('**/api/generation/readiness', async (route) => {
    await route.fulfill({
      json: {
        activeProvider: 'custom',
        issue: null,
        mode: 'external',
        runtime: null,
        status: 'ready',
      },
    });
  });

  await page.route('**/api/generation/chat-reply-jobs', async (route) => {
    const body = route.request().postDataJSON() as {
      chatId: string;
      message: string;
    };
    const createdAt = new Date().toISOString();

    await route.fulfill({
      json: {
        job: {
          id: '00000000-0000-4000-8000-000000000211',
          kind: 'chat_reply',
          chatId: body.chatId,
          status: 'completed',
          error: null,
          createdAt,
          startedAt: createdAt,
          completedAt: createdAt,
          updatedAt: createdAt,
        },
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
          generationSettings: {
            samplerPresetId: null,
            systemPrompt: null,
            sampling: {
              contextTrimStrategy: null,
              maxContextLength: null,
              maxTokens: null,
              minP: null,
              presencePenalty: null,
              repeatPenalty: null,
              repeatPenaltyRange: null,
              temperature: null,
              topK: null,
              topP: null,
            },
          },
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

  const transcript = page.locator('.chat-transcript');
  await expect(transcript.getByText('Smoke user message')).toBeVisible();
  await expect(transcript.getByText('Smoke assistant reply')).toBeVisible();

  await page.goto('/chat');
  await expect(page.getByRole('link', { name: /Smoke MVP chat/i })).toBeVisible();
});

test('shows prompt preview for a generic chat without global RP context', async ({ page }) => {
  await page.goto('/chat');
  await page.getByLabel('Название чата').fill('Prompt preview chat');
  await page.getByRole('button', { name: 'Создать чат' }).click();

  await expect(page).toHaveURL(/\/chat\/[A-Za-z0-9_-]+$/);
  await expect(page.getByRole('heading', { name: 'Prompt preview chat' })).toBeVisible();

  await page.getByText('Контекст модели').click();
  await expect(page.getByText('Фактический payload перед генерацией')).toBeVisible();
  await expect(page.getByText('system: 0')).toBeVisible();
  await expect(page.getByText('Payload пока пуст. Напишите сообщение в чат.')).toBeVisible();
  await expect(page.getByText(/Пиши как/)).toHaveCount(0);
  await expect(page.getByText(/Инженер/)).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Сообщение' }).fill('Проверка черновика');
  await expect(page.getByText('Проверка черновика')).toBeVisible();
  await expect(page.getByText('Payload пока пуст. Напишите сообщение в чат.')).toHaveCount(0);
});

test('saves per-chat generation settings and refreshes prompt preview', async ({ page }) => {
  await page.goto('/chat');
  await page.getByLabel('Название чата').fill('Per-chat settings chat');
  await page.getByRole('button', { name: 'Создать чат' }).click();

  await expect(page).toHaveURL(/\/chat\/[A-Za-z0-9_-]+$/);
  await page.getByText('Настройки генерации').click();
  await page.getByLabel('Системный prompt чата').fill('Отвечай коротко только в этом чате.');
  await page.getByLabel('Sampler preset').selectOption('smoke-model-preset');
  await page.getByLabel('Размер контекста').fill('4096');
  await page.getByLabel('Max tokens').fill('123');

  const saveResponse = page.waitForResponse((response) => {
    return response.url().includes('/api/chats/') && response.url().includes('/generation-settings');
  });

  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByText('Настройки чата сохранены.')).toBeVisible();
  await saveResponse;

  await page.getByText('Контекст модели').click();
  await expect(page.getByLabel('Сообщения payload').getByText('Отвечай коротко только в этом чате.')).toBeVisible();
  await expect(page.getByText('system: 1')).toBeVisible();
  await expect(page.locator('.prompt-preview-stats')).toContainText('Smoke Model');
  await expect(page.locator('.prompt-preview-stats')).toContainText('123');
  await expect(page.getByText(/Пиши как/)).toHaveCount(0);

  await page.reload();
  await page.getByText('Настройки генерации').click();
  await expect(page.getByLabel('Системный prompt чата')).toHaveValue('Отвечай коротко только в этом чате.');
  await expect(page.getByLabel('Sampler preset')).toHaveValue('smoke-model-preset');
  await expect(page.getByLabel('Размер контекста')).toHaveValue('4096');
  await expect(page.getByLabel('Max tokens')).toHaveValue('123');
});

test('sends chat messages with Enter and shows the user message while generation is pending', async ({ page }) => {
  await page.route('**/api/generation/readiness', async (route) => {
    await route.fulfill({
      json: {
        activeProvider: 'custom',
        issue: null,
        mode: 'external',
        runtime: null,
        status: 'ready',
      },
    });
  });

  let releaseGeneration: () => void = () => undefined;
  let resolveGenerationStarted: () => void = () => undefined;
  const generationStarted = new Promise<void>((resolve) => {
    resolveGenerationStarted = resolve;
  });
  let enterSendChatId = '';

  await page.route('**/api/generation/chat-reply-jobs', async (route) => {
    const body = route.request().postDataJSON() as {
      chatId: string;
      message: string;
    };
    enterSendChatId = body.chatId;
    const createdAt = new Date().toISOString();
    const job = {
      id: '00000000-0000-4000-8000-000000000302',
      kind: 'chat_reply',
      chatId: body.chatId,
      status: 'running',
      error: null,
      createdAt,
      startedAt: createdAt,
      completedAt: null,
      updatedAt: createdAt,
    };

    resolveGenerationStarted();
    await route.fulfill({
      json: {
        job,
        session: {
          chat: {
            id: body.chatId,
            title: 'Enter send chat',
            createdAt,
            updatedAt: createdAt,
            messageCount: 1,
            lastMessagePreview: body.message,
            characterName: null,
          },
          userName: 'Tester',
          characterName: null,
          generationSettings: {
            samplerPresetId: null,
            systemPrompt: null,
            sampling: {
              contextTrimStrategy: null,
              maxContextLength: null,
              maxTokens: null,
              minP: null,
              presencePenalty: null,
              repeatPenalty: null,
              repeatPenaltyRange: null,
              temperature: null,
              topK: null,
              topP: null,
            },
          },
          messages: [
            {
              id: `${body.chatId}:1`,
              role: 'user',
              content: body.message,
              createdAt,
            },
          ],
        },
      },
    });
  });

  await page.route('**/api/generation/jobs/*/events', async (route) => {
    await new Promise<void>((resolve) => {
      releaseGeneration = resolve;
    });

    const createdAt = new Date().toISOString();
    const chatId = enterSendChatId;
    const completedJob = {
      id: '00000000-0000-4000-8000-000000000302',
      kind: 'chat_reply',
      chatId,
      status: 'completed',
      error: null,
      createdAt,
      startedAt: createdAt,
      completedAt: createdAt,
      updatedAt: createdAt,
    };
    const session = {
      chat: {
        id: chatId,
        title: 'Enter send chat',
        createdAt,
        updatedAt: createdAt,
        messageCount: 2,
        lastMessagePreview: 'Delayed assistant reply',
        characterName: null,
      },
      userName: 'Tester',
      characterName: null,
      generationSettings: {
        samplerPresetId: null,
        systemPrompt: null,
        sampling: {
          contextTrimStrategy: null,
          maxContextLength: null,
          maxTokens: null,
          minP: null,
          presencePenalty: null,
          repeatPenalty: null,
          repeatPenaltyRange: null,
          temperature: null,
          topK: null,
          topP: null,
        },
      },
      messages: [
        {
          id: `${chatId}:1`,
          role: 'user',
          content: 'Enter smoke message',
          createdAt,
        },
        {
          id: `${chatId}:2`,
          role: 'assistant',
          content: 'Delayed assistant reply',
          createdAt,
        },
      ],
    };

    await route.fulfill({
      body: [
        `event: chat.session.updated\ndata: ${JSON.stringify({
          type: 'chat.session.updated',
          job: completedJob,
          session,
        })}\n\n`,
        `event: generation.job.updated\ndata: ${JSON.stringify({
          type: 'generation.job.updated',
          job: completedJob,
        })}\n\n`,
      ].join(''),
      contentType: 'text/event-stream',
    });
  });

  await page.goto('/chat');
  await page.getByLabel('Название чата').fill('Enter send chat');
  await page.getByRole('button', { name: 'Создать чат' }).click();
  await expect(page).toHaveURL(/\/chat\/[A-Za-z0-9_-]+$/);

  const messageInput = page.getByRole('textbox', { name: 'Сообщение' });
  await messageInput.fill('Enter smoke message');
  await messageInput.press('Enter');
  await generationStarted;

  await expect(page.getByText('Enter smoke message')).toBeVisible();
  await expect(messageInput).toHaveValue('');
  await expect(page.locator('.message-list__meta')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Отменить' })).toBeVisible();

  releaseGeneration();
  await expect(page.getByText('Delayed assistant reply')).toBeVisible();
});

test('cancels a pending chat generation request from the composer', async ({ page }) => {
  await page.route('**/api/generation/readiness', async (route) => {
    await route.fulfill({
      json: {
        activeProvider: 'custom',
        issue: null,
        mode: 'external',
        runtime: null,
        status: 'ready',
      },
    });
  });

  let releaseGeneration: () => void = () => undefined;
  let resolveGenerationStarted: () => void = () => undefined;
  const generationStarted = new Promise<void>((resolve) => {
    resolveGenerationStarted = resolve;
  });
  let cancelChatId = '';

  await page.route('**/api/generation/chat-reply-jobs', async (route) => {
    const body = route.request().postDataJSON() as {
      chatId: string;
      message: string;
    };
    const createdAt = new Date().toISOString();
    cancelChatId = body.chatId;

    resolveGenerationStarted();

    await route.fulfill({
      json: {
        job: {
          id: '00000000-0000-4000-8000-000000000403',
          kind: 'chat_reply',
          chatId: body.chatId,
          status: 'running',
          error: null,
          createdAt,
          startedAt: createdAt,
          completedAt: null,
          updatedAt: createdAt,
        },
        session: {
          chat: {
            id: body.chatId,
            title: 'Cancel generation chat',
            createdAt,
            updatedAt: createdAt,
            messageCount: 1,
            lastMessagePreview: body.message,
            characterName: null,
          },
          userName: 'Tester',
          characterName: null,
          generationSettings: {
            samplerPresetId: null,
            systemPrompt: null,
            sampling: {
              contextTrimStrategy: null,
              maxContextLength: null,
              maxTokens: null,
              minP: null,
              presencePenalty: null,
              repeatPenalty: null,
              repeatPenaltyRange: null,
              temperature: null,
              topK: null,
              topP: null,
            },
          },
          messages: [
            {
              id: `${body.chatId}:1`,
              role: 'user',
              content: body.message,
              createdAt,
            },
          ],
        },
      },
    });
  });

  await page.route('**/api/generation/jobs/*/events', async (route) => {
    await new Promise<void>((resolve) => {
      releaseGeneration = resolve;
    });

    const createdAt = new Date().toISOString();
    const canceledJob = {
      id: '00000000-0000-4000-8000-000000000403',
      kind: 'chat_reply',
      chatId: cancelChatId,
      status: 'canceled',
      error: null,
      createdAt,
      startedAt: createdAt,
      completedAt: createdAt,
      updatedAt: createdAt,
    };

    await route.fulfill({
      body: `event: generation.job.updated\ndata: ${JSON.stringify({
        type: 'generation.job.updated',
        job: canceledJob,
      })}\n\n`,
      contentType: 'text/event-stream',
    });
  });

  await page.route('**/api/generation/jobs/*/cancel', async (route) => {
    const createdAt = new Date().toISOString();

    releaseGeneration();
    await route.fulfill({
      json: {
        job: {
          id: '00000000-0000-4000-8000-000000000403',
          kind: 'chat_reply',
          chatId: cancelChatId,
          status: 'canceled',
          error: null,
          createdAt,
          startedAt: createdAt,
          completedAt: createdAt,
          updatedAt: createdAt,
        },
      },
    });
  });

  await page.goto('/chat');
  await page.getByLabel('Название чата').fill('Cancel generation chat');
  await page.getByRole('button', { name: 'Создать чат' }).click();
  await expect(page).toHaveURL(/\/chat\/[A-Za-z0-9_-]+$/);

  const messageInput = page.getByRole('textbox', { name: 'Сообщение' });
  await messageInput.fill('Cancel smoke message');
  await page.getByRole('button', { name: 'Отправить' }).click();
  await generationStarted;

  await expect(page.getByText('Cancel smoke message')).toBeVisible();
  await page.getByRole('button', { name: 'Отменить' }).click();
  releaseGeneration();

  await expect(page.getByRole('button', { name: 'Отправить' })).toBeVisible();
  await expect(page.getByText('Canceled generation should not reach the chat.')).toHaveCount(0);
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

  await page.route('**/api/generation/chat-reply-jobs', async (route) => {
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
