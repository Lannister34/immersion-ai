import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import {
  ChatListResponseSchema,
  CreateChatResponseSchema,
  GetChatSessionResponseSchema,
} from '@immersion/contracts/chats';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApiApp } from './app.js';

const fixtureDataRoot = fileURLToPath(new URL('../testdata/smoke-data', import.meta.url));

describe('chat routes', () => {
  let previousDataRoot: string | undefined;
  let temporaryDataRoot: string;

  beforeEach(async () => {
    previousDataRoot = process.env.IMMERSION_DATA_ROOT;
    temporaryDataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'immersion-api-chats-'));
    await fs.cp(fixtureDataRoot, temporaryDataRoot, { recursive: true });
    process.env.IMMERSION_DATA_ROOT = temporaryDataRoot;
  });

  afterEach(async () => {
    if (previousDataRoot) {
      process.env.IMMERSION_DATA_ROOT = previousDataRoot;
    } else {
      delete process.env.IMMERSION_DATA_ROOT;
    }

    await fs.rm(temporaryDataRoot, { recursive: true, force: true });
  });

  async function writeGenericChatFile(chatId: string, lines: string[]) {
    const chatsDirectory = path.join(temporaryDataRoot, 'chats', '_no_character_');
    await fs.mkdir(chatsDirectory, { recursive: true });
    await fs.writeFile(path.join(chatsDirectory, `${chatId}.jsonl`), `${lines.join('\n')}\n`, 'utf8');
  }

  it('creates a generic chat and exposes it through list and session routes', async () => {
    const app = buildApiApp();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/chats',
      payload: {
        title: 'Проверка MVP',
      },
    });
    const createPayload = CreateChatResponseSchema.parse(createResponse.json());

    expect(createResponse.statusCode).toBe(201);
    expect(createPayload.chat.title).toBe('Проверка MVP');
    expect(createPayload.chat.messageCount).toBe(0);

    const filePath = path.join(temporaryDataRoot, 'chats', '_no_character_', `${createPayload.chat.id}.jsonl`);
    await expect(fs.access(filePath)).resolves.toBeUndefined();
    const headerLine = (await fs.readFile(filePath, 'utf8')).split(/\r?\n/u)[0] ?? '';
    expect(headerLine).not.toBe('');
    const headerPayload = JSON.parse(headerLine) as {
      chat_metadata: {
        createdAt: string;
        title: string;
        updatedAt: string;
      };
      character_name: string;
      user_name: string;
    };

    expect(headerPayload).toMatchObject({
      chat_metadata: {
        title: 'Проверка MVP',
        createdAt: createPayload.chat.createdAt,
        updatedAt: createPayload.chat.updatedAt,
      },
      character_name: '',
      user_name: '\u0422\u0435\u0441\u0442\u0435\u0440',
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/chats',
    });
    const listPayload = ChatListResponseSchema.parse(listResponse.json());

    expect(listResponse.statusCode).toBe(200);
    expect(listPayload.items).toHaveLength(1);
    expect(listPayload.items[0]).toMatchObject({
      id: createPayload.chat.id,
      title: 'Проверка MVP',
      messageCount: 0,
      lastMessagePreview: null,
      characterName: null,
    });

    const sessionResponse = await app.inject({
      method: 'GET',
      url: `/api/chats/${createPayload.chat.id}`,
    });
    const sessionPayload = GetChatSessionResponseSchema.parse(sessionResponse.json());

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionPayload.chat.id).toBe(createPayload.chat.id);
    expect(sessionPayload.userName).toBe('\u0422\u0435\u0441\u0442\u0435\u0440');
    expect(sessionPayload.messages).toEqual([]);

    await app.close();
  });

  it('parses existing legacy generic chat files and sorts summaries by latest activity', async () => {
    await writeGenericChatFile('older-chat', [
      JSON.stringify({
        chat_metadata: {
          createdAt: '2026-01-01T00:00:00.000Z',
          title: 'Старый чат',
          updatedAt: '2026-01-01T00:01:00.000Z',
        },
        user_name: 'Тестер',
        character_name: '',
      }),
      JSON.stringify({
        is_user: false,
        mes: 'Старый ответ',
        send_date: '2026-01-01T00:01:00.000Z',
      }),
    ]);
    await writeGenericChatFile('legacy-session', [
      JSON.stringify({
        user_name: 'Тестер',
        character_name: '',
      }),
      JSON.stringify({
        is_user: true,
        mes: 'Первое сообщение',
        send_date: '2026-01-02T00:00:00.000Z',
      }),
      JSON.stringify({
        is_user: false,
        mes: 'Системная заметка',
        send_date: '2026-01-02T00:01:00.000Z',
        extra: {
          type: 'system',
        },
      }),
      JSON.stringify({
        is_user: false,
        mes: 'Ответ модели',
        send_date: '2026-01-02T00:02:00.000Z',
      }),
    ]);

    const app = buildApiApp();
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/chats',
    });
    const listPayload = ChatListResponseSchema.parse(listResponse.json());

    expect(listResponse.statusCode).toBe(200);
    expect(listPayload.items.map((item) => item.id)).toEqual(['legacy-session', 'older-chat']);
    expect(listPayload.items[0]).toMatchObject({
      title: 'Первое сообщение',
      lastMessagePreview: 'Ответ модели',
      messageCount: 3,
      updatedAt: '2026-01-02T00:02:00.000Z',
      characterName: null,
    });

    const sessionResponse = await app.inject({
      method: 'GET',
      url: '/api/chats/legacy-session',
    });
    const sessionPayload = GetChatSessionResponseSchema.parse(sessionResponse.json());

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionPayload.messages.map((message) => message.role)).toEqual(['user', 'system', 'assistant']);
    expect(sessionPayload.messages.map((message) => message.content)).toEqual([
      'Первое сообщение',
      'Системная заметка',
      'Ответ модели',
    ]);
    expect(sessionPayload.chat.title).toBe('Первое сообщение');

    await app.close();
  });

  it('fails fast when a canonical chat file is malformed', async () => {
    await writeGenericChatFile('broken-session', [
      JSON.stringify({
        user_name: 'Тестер',
        character_name: '',
      }),
      'not-json',
    ]);

    const app = buildApiApp();
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/chats',
    });
    const sessionResponse = await app.inject({
      method: 'GET',
      url: '/api/chats/broken-session',
    });

    expect(listResponse.statusCode).toBe(500);
    expect(listResponse.json()).toMatchObject({
      code: 'internal_error',
    });
    expect(sessionResponse.statusCode).toBe(500);
    expect(sessionResponse.json()).toMatchObject({
      code: 'internal_error',
    });

    await app.close();
  });

  it('returns 400 for an invalid create command', async () => {
    const app = buildApiApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/chats',
      payload: {
        title: '',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'validation_error',
    });

    await app.close();
  });

  it('returns 400 for an invalid chat id', async () => {
    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/chats/invalid.chat.id',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'validation_error',
    });

    await app.close();
  });

  it('returns 404 for an unknown chat id', async () => {
    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/chats/missing-chat',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: 'chat_not_found',
    });

    await app.close();
  });
});
