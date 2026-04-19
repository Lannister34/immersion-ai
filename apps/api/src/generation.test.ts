import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import {
  type ChatMessageDto,
  CreateChatResponseSchema,
  GetChatSessionResponseSchema,
} from '@immersion/contracts/chats';
import {
  ChatReplyGenerationErrorResponseSchema,
  ChatReplyGenerationResponseSchema,
  GenerationReadinessResponseSchema,
} from '@immersion/contracts/generation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApiApp } from './app.js';

const fixtureDataRoot = fileURLToPath(new URL('../testdata/smoke-data', import.meta.url));

interface ProviderRequestRecord {
  authorization: string | null;
  body: unknown;
  url: string;
}

interface ProviderRequestMessageRecord {
  content?: string;
  role?: string;
}

interface ProviderRequestBodyRecord {
  max_tokens?: number;
  messages?: ProviderRequestMessageRecord[];
  min_p?: number;
  presence_penalty?: number;
  rep_pen?: number;
  rep_pen_range?: number;
  temperature?: number;
  top_k?: number;
  top_p?: number;
}

const ACTIVE_SMOKE_SAMPLING = {
  max_tokens: 640,
  min_p: 0.03,
  presence_penalty: 0.15,
  rep_pen: 1.08,
  rep_pen_range: 1024,
  temperature: 0.72,
  top_k: 42,
  top_p: 0.91,
};

const MODEL_BOUND_SMOKE_SAMPLING = {
  max_tokens: 777,
  min_p: 0.04,
  presence_penalty: 0.2,
  rep_pen: 1.11,
  rep_pen_range: 512,
  temperature: 0.44,
  top_k: 7,
  top_p: 0.82,
};

const EMPTY_CHAT_SAMPLING_OVERRIDES = {
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
};

interface SmokeUserSettingsFixture {
  activeProvider?: string;
  backendMode?: string;
  activePresetId?: string;
  modelPresetMap?: Record<string, string>;
  providerConfigs?: {
    custom?: {
      apiKey?: string;
      model?: string;
      url?: string;
    };
    koboldcpp?: {
      model?: string;
      url?: string;
    };
  };
  samplerPresets?: Array<Record<string, unknown>>;
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

  function getProviderRequestBody(request: ProviderRequestRecord | undefined): ProviderRequestBodyRecord {
    if (!request?.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
      throw new Error('Provider request body was not recorded.');
    }

    return request.body as ProviderRequestBodyRecord;
  }

  async function writeExternalProviderSettings(url: string, model = 'smoke-model') {
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
              model,
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

  async function writeProviderSettings(patch: SmokeUserSettingsFixture) {
    const settingsPath = path.join(temporaryDataRoot, 'user-settings.json');
    const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8')) as SmokeUserSettingsFixture;

    await fs.writeFile(
      settingsPath,
      JSON.stringify(
        {
          ...settings,
          ...patch,
          providerConfigs: {
            ...settings.providerConfigs,
            ...patch.providerConfigs,
          },
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  async function writeDetachedRuntimeState(modelPath: string, port = 6006) {
    await fs.writeFile(
      path.join(temporaryDataRoot, '.llm-server.json'),
      JSON.stringify(
        {
          model: path.basename(modelPath),
          modelPath,
          pid: process.pid,
          port,
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  async function updateChatGenerationSettings(app: ReturnType<typeof buildApiApp>, chatId: string, payload: object) {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/chats/${chatId}/generation-settings`,
      payload,
    });

    expect(response.statusCode).toBe(200);
  }

  it('reports generation readiness for a configured external provider', async () => {
    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/generation/readiness',
    });
    const payload = GenerationReadinessResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(payload).toMatchObject({
      activeProvider: 'custom',
      issue: null,
      mode: 'external',
      runtime: null,
      status: 'ready',
    });

    await app.close();
  });

  it('blocks generation readiness when the external provider URL is missing', async () => {
    await writeProviderSettings({
      activeProvider: 'custom',
      backendMode: 'external',
      providerConfigs: {
        custom: {
          url: '   ',
        },
      },
    });
    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/generation/readiness',
    });
    const payload = GenerationReadinessResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(payload).toMatchObject({
      issue: {
        code: 'external_provider_url_missing',
      },
      mode: 'external',
      status: 'blocked',
    });

    await app.close();
  });

  it('blocks generation readiness when the external provider URL is invalid', async () => {
    await writeProviderSettings({
      activeProvider: 'custom',
      backendMode: 'external',
      providerConfigs: {
        custom: {
          url: 'not-a-url',
        },
      },
    });
    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/generation/readiness',
    });
    const payload = GenerationReadinessResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(payload).toMatchObject({
      issue: {
        code: 'external_provider_url_invalid',
      },
      mode: 'external',
      status: 'blocked',
    });

    await app.close();
  });

  it('blocks generation readiness when builtin runtime is not running', async () => {
    await writeProviderSettings({
      backendMode: 'builtin',
    });
    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/generation/readiness',
    });
    const payload = GenerationReadinessResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(payload.mode).toBe('builtin');
    expect(payload.status).toBe('blocked');
    expect(payload.issue?.code).toMatch(/^builtin_/u);
    expect(payload.runtime).not.toBeNull();

    await app.close();
  });

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
      ...MODEL_BOUND_SMOKE_SAMPLING,
      messages: expect.arrayContaining([
        {
          role: 'user',
          content: 'Hello model.',
        },
      ]),
      model: 'smoke-model',
      stream: false,
    });
    const requestBody = getProviderRequestBody(providerRequests[0]);
    const submittedMessages =
      requestBody.messages?.filter((message) => message.role === 'user' && message.content === 'Hello model.') ?? [];

    expect(submittedMessages).toHaveLength(1);

    const sessionResponse = await app.inject({
      method: 'GET',
      url: `/api/chats/${chat.id}`,
    });
    const sessionPayload = GetChatSessionResponseSchema.parse(sessionResponse.json());

    expect(getMessagesByRole(sessionPayload.messages)).toEqual(getMessagesByRole(payload.session.messages));

    await app.close();
  });

  it('falls back to the active sampler preset when the provider model has no binding', async () => {
    await writeExternalProviderSettings('http://127.0.0.1:6006', 'unbound-model');
    const providerRequests = mockProviderSuccess('Assistant reply from unbound provider.');
    const app = buildApiApp();
    const chat = await createChat(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/generation/chat-reply',
      payload: {
        chatId: chat.id,
        message: 'Use active preset.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(providerRequests).toHaveLength(1);
    expect(providerRequests[0]?.body).toMatchObject({
      ...ACTIVE_SMOKE_SAMPLING,
      model: 'unbound-model',
      stream: false,
    });

    await app.close();
  });

  it('applies chat-owned generation settings over model-bound sampler presets', async () => {
    const providerRequests = mockProviderSuccess('Assistant reply with chat overrides.');
    const app = buildApiApp();
    const chat = await createChat(app);

    await updateChatGenerationSettings(app, chat.id, {
      samplerPresetId: 'default',
      systemPrompt: 'Custom system prompt for this chat.',
      sampling: {
        ...EMPTY_CHAT_SAMPLING_OVERRIDES,
        maxContextLength: 4096,
        maxTokens: 222,
        temperature: 0.55,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/generation/chat-reply',
      payload: {
        chatId: chat.id,
        message: 'Use chat settings.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(providerRequests).toHaveLength(1);
    expect(providerRequests[0]?.body).toMatchObject({
      ...ACTIVE_SMOKE_SAMPLING,
      max_tokens: 222,
      model: 'smoke-model',
      stream: false,
      temperature: 0.55,
    });
    const requestBody = getProviderRequestBody(providerRequests[0]);
    const systemMessages = requestBody.messages?.filter((message) => message.role === 'system') ?? [];

    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0]?.content).toContain('Custom system prompt for this chat.');

    await app.close();
  });

  it('ignores stale sampler bindings and uses the active preset', async () => {
    await writeProviderSettings({
      modelPresetMap: {
        'smoke-model': 'missing-preset',
      },
    });
    const providerRequests = mockProviderSuccess('Assistant reply with active preset.');
    const app = buildApiApp();
    const chat = await createChat(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/generation/chat-reply',
      payload: {
        chatId: chat.id,
        message: 'Ignore stale binding.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(providerRequests).toHaveLength(1);
    expect(providerRequests[0]?.body).toMatchObject({
      ...ACTIVE_SMOKE_SAMPLING,
      model: 'smoke-model',
      stream: false,
    });

    await app.close();
  });

  it('falls back to the active sampler preset when provider model is blank', async () => {
    await writeExternalProviderSettings('http://127.0.0.1:6006', '   ');
    const providerRequests = mockProviderSuccess('Assistant reply with default transport model.');
    const app = buildApiApp();
    const chat = await createChat(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/generation/chat-reply',
      payload: {
        chatId: chat.id,
        message: 'Use fallback model and active preset.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(providerRequests).toHaveLength(1);
    expect(providerRequests[0]?.body).toMatchObject({
      ...ACTIVE_SMOKE_SAMPLING,
      model: 'local-model',
      stream: false,
    });

    await app.close();
  });

  it('binds builtin runtime sampler presets by the canonical scanned model name', async () => {
    const nestedModelPath = path.join(temporaryDataRoot, 'models', 'nested', 'secondary.gguf');
    await writeProviderSettings({
      backendMode: 'builtin',
      modelPresetMap: {
        'nested/secondary.gguf': 'smoke-model-preset',
      },
    });
    await writeDetachedRuntimeState(nestedModelPath);
    const providerRequests = mockProviderSuccess('Assistant reply from builtin runtime.');
    const app = buildApiApp();
    const chat = await createChat(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/generation/chat-reply',
      payload: {
        chatId: chat.id,
        message: 'Use builtin canonical model.',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(providerRequests).toHaveLength(1);
    expect(providerRequests[0]).toMatchObject({
      authorization: null,
      url: 'http://127.0.0.1:6006/v1/chat/completions',
    });
    expect(providerRequests[0]?.body).toMatchObject({
      ...MODEL_BOUND_SMOKE_SAMPLING,
      model: 'nested/secondary.gguf',
      stream: false,
    });

    await app.close();
  });

  it('persists the user message without an assistant reply when the provider fails', async () => {
    const providerRequests = mockProviderFailure();
    const app = buildApiApp();
    const chat = await createChat(app);

    await updateChatGenerationSettings(app, chat.id, {
      samplerPresetId: null,
      systemPrompt: 'Preserve this setting on provider failure.',
      sampling: EMPTY_CHAT_SAMPLING_OVERRIDES,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/generation/chat-reply',
      payload: {
        chatId: chat.id,
        message: 'Persist this before provider failure.',
      },
    });
    const errorPayload = ChatReplyGenerationErrorResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(502);
    expect(errorPayload).toMatchObject({
      code: 'provider_generation_failed',
      session: {
        messages: [
          {
            role: 'user',
            content: 'Persist this before provider failure.',
          },
        ],
        generationSettings: {
          systemPrompt: 'Preserve this setting on provider failure.',
        },
      },
    });
    expect(providerRequests).toHaveLength(1);

    const sessionResponse = await app.inject({
      method: 'GET',
      url: `/api/chats/${chat.id}`,
    });
    const sessionPayload = GetChatSessionResponseSchema.parse(sessionResponse.json());

    expect(getMessagesByRole(sessionPayload.messages)).toEqual([
      {
        role: 'user',
        content: 'Persist this before provider failure.',
      },
    ]);

    await app.close();
  });

  it('persists the user message when provider endpoint resolution is unavailable', async () => {
    await writeProviderSettings({
      backendMode: 'builtin',
    });
    const providerRequests = mockProviderSuccess('Should not be called.');
    const app = buildApiApp();
    const chat = await createChat(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/generation/chat-reply',
      payload: {
        chatId: chat.id,
        message: 'Keep this while provider is offline.',
      },
    });
    const errorPayload = ChatReplyGenerationErrorResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(409);
    expect(errorPayload).toMatchObject({
      code: 'generation_provider_unavailable',
      session: {
        messages: [
          {
            role: 'user',
            content: 'Keep this while provider is offline.',
          },
        ],
      },
    });
    expect(providerRequests).toHaveLength(0);

    const sessionResponse = await app.inject({
      method: 'GET',
      url: `/api/chats/${chat.id}`,
    });
    const sessionPayload = GetChatSessionResponseSchema.parse(sessionResponse.json());

    expect(getMessagesByRole(sessionPayload.messages)).toEqual([
      {
        role: 'user',
        content: 'Keep this while provider is offline.',
      },
    ]);

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
