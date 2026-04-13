import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import {
  type ChatMessageDto,
  CreateChatResponseSchema,
  GetChatSessionResponseSchema,
} from '@immersion/contracts/chats';
import { ChatReplyGenerationResponseSchema } from '@immersion/contracts/generation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApiApp } from './app.js';

const fixtureDataRoot = fileURLToPath(new URL('../testdata/smoke-data', import.meta.url));

interface ProviderRequestRecord {
  authorization: string | null;
  body: unknown;
  url: string;
}

interface SmokeUserSettingsFixture {
  activeProvider?: string;
  backendMode?: string;
  providerConfigs?: {
    custom?: {
      apiKey?: string;
      url?: string;
    };
    koboldcpp?: {
      url?: string;
    };
  };
}

describe('generation routes', () => {
  let previousDataRoot: string | undefined;
  let temporaryDataRoot: string;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    previousDataRoot = process.env.IMMERSION_DATA_ROOT;
    temporaryDataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'immersion-api-generation-'));
    await fs.cp(fixtureDataRoot, temporaryDataRoot, { recursive: true });
    process.env.IMMERSION_DATA_ROOT = temporaryDataRoot;
    await writeExternalProviderSettings('http://127.0.0.1:6006');
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();

    if (previousDataRoot) {
      process.env.IMMERSION_DATA_ROOT = previousDataRoot;
    } else {
      delete process.env.IMMERSION_DATA_ROOT;
    }

    await fs.rm(temporaryDataRoot, { recursive: true, force: true });
  });

  function mockProviderSuccess(content: string) {
    const requests: ProviderRequestRecord[] = [];

    globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      requests.push({
        authorization: headers.get('authorization'),
        body,
        url: input instanceof Request ? input.url : input.toString(),
      });

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content,
              },
            },
          ],
        }),
        {
          headers: {
            'Content-Type': 'application/json',
          },
          status: 200,
        },
      );
    }) as typeof fetch;

    return requests;
  }

  function mockProviderFailure() {
    const requests: ProviderRequestRecord[] = [];

    globalThis.fetch = vi.fn(async () => {
      requests.push({
        authorization: null,
        body: null,
        url: 'mock-provider-failure',
      });

      return new Response(JSON.stringify({ error: 'provider failed' }), {
        headers: {
          'Content-Type': 'application/json',
        },
        status: 500,
      });
    }) as typeof fetch;

    return requests;
  }

  async function createChat(app: ReturnType<typeof buildApiApp>) {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/chats',
      payload: {
        title: 'Generation MVP',
      },
    });

    return CreateChatResponseSchema.parse(createResponse.json()).chat;
  }

  function getMessagesByRole(messages: ChatMessageDto[]) {
    return messages.map((message) => ({
      content: message.content,
      role: message.role,
    }));
  }

  async function writeExternalProviderSettings(url: string) {
    const settingsPath = path.join(temporaryDataRoot, 'user-settings.json');
    const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8')) as SmokeUserSettingsFixture;
    const providerConfigs = settings.providerConfigs ?? {};

    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          ...settings,
          activeProvider: 'custom',
          backendMode: 'external',
          providerConfigs: {
            ...providerConfigs,
            custom: {
              ...providerConfigs.custom,
              apiKey: 'secret-token',
              url,
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  it('calls the active provider and persists the user message with the assistant reply', async () => {
    const providerRequests = mockProviderSuccess('Assistant reply from provider.');
    const app = buildApiApp();
    const chat = await createChat(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/generation/chat-reply',
      payload: {
        chatId: chat.id,
        message: 'Hello model.',
      },
    });
    const payload = ChatReplyGenerationResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(getMessagesByRole(payload.session.messages)).toEqual([
      {
        role: 'user',
        content: 'Hello model.',
      },
      {
        role: 'assistant',
        content: 'Assistant reply from provider.',
      },
    ]);
    expect(providerRequests).toHaveLength(1);
    expect(providerRequests[0]).toMatchObject({
      authorization: 'Bearer secret-token',
      url: 'http://127.0.0.1:6006/v1/chat/completions',
    });
    expect(providerRequests[0]?.body).toMatchObject({
      max_tokens: 512,
      messages: expect.arrayContaining([
        {
          role: 'user',
          content: 'Hello model.',
        },
      ]),
      model: 'local-model',
      stream: false,
    });

    const sessionResponse = await app.inject({
      method: 'GET',
      url: `/api/chats/${chat.id}`,
    });
    const sessionPayload = GetChatSessionResponseSchema.parse(sessionResponse.json());

    expect(getMessagesByRole(sessionPayload.messages)).toEqual(getMessagesByRole(payload.session.messages));

    await app.close();
  });

  it('does not mutate the chat transcript when the provider fails', async () => {
    const providerRequests = mockProviderFailure();
    const app = buildApiApp();
    const chat = await createChat(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/generation/chat-reply',
      payload: {
        chatId: chat.id,
        message: 'Persist this before provider failure.',
      },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({
      code: 'provider_generation_failed',
    });
    expect(providerRequests).toHaveLength(1);

    const sessionResponse = await app.inject({
      method: 'GET',
      url: `/api/chats/${chat.id}`,
    });
    const sessionPayload = GetChatSessionResponseSchema.parse(sessionResponse.json());

    expect(getMessagesByRole(sessionPayload.messages)).toEqual([]);

    await app.close();
  });

  it('returns 404 for a missing chat without calling the provider', async () => {
    const providerRequests = mockProviderSuccess('Should not be called.');
    const app = buildApiApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/generation/chat-reply',
      payload: {
        chatId: 'missing-chat',
        message: 'Hello?',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: 'chat_not_found',
    });
    expect(providerRequests).toHaveLength(0);

    await app.close();
  });
});
