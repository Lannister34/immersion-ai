import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FileChatRepository } from './file-chat-repository.js';

describe('FileChatRepository', () => {
  let previousDataRoot: string | undefined;
  let temporaryDataRoot: string;

  beforeEach(async () => {
    previousDataRoot = process.env.IMMERSION_DATA_ROOT;
    temporaryDataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'immersion-api-chat-repository-'));
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

  function resolveChatFilePath(chatId: string) {
    return path.join(temporaryDataRoot, 'chats', '_no_character_', `${chatId}.jsonl`);
  }

  it('serializes concurrent appends and leaves a coherent JSONL chat file', async () => {
    const chatId = 'concurrent-chat';
    const repository = new FileChatRepository();
    const expectedMessages = Array.from({ length: 24 }, (_, index) => ({
      content: `message-${index.toString().padStart(2, '0')}`,
      createdAt: `2026-01-01T00:00:${index.toString().padStart(2, '0')}.000Z`,
    }));

    await repository.createGenericChat({
      id: chatId,
      title: 'Concurrent chat',
      userName: 'Tester',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    await Promise.all(
      expectedMessages.map((message) =>
        repository.appendGenericChatMessages(chatId, [
          {
            role: 'user',
            content: message.content,
            createdAt: message.createdAt,
          },
        ]),
      ),
    );

    const session = await repository.getGenericChatSession(chatId);

    if (!session) {
      throw new Error('Expected chat session to exist after concurrent appends.');
    }

    expect(session.messages.map((message) => message.content)).toEqual(
      expectedMessages.map((message) => message.content),
    );
    expect(session.chat.messageCount).toBe(expectedMessages.length);
    expect(session.chat.lastMessagePreview).toBe(expectedMessages.at(-1)?.content);
    expect(session.chat.updatedAt).toBe(expectedMessages.at(-1)?.createdAt);

    const chatFilePath = resolveChatFilePath(chatId);
    const rawLines = (await fs.readFile(chatFilePath, 'utf8')).split(/\r?\n/u).filter((line) => line.trim().length > 0);
    const parsedLines = rawLines.map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(parsedLines[0]).toHaveProperty('chat_metadata');
    expect(parsedLines.slice(1).map((line) => line.mes)).toEqual(expectedMessages.map((message) => message.content));

    const directoryEntries = await fs.readdir(path.dirname(chatFilePath));
    expect(directoryEntries.filter((entry) => entry.endsWith('.tmp'))).toEqual([]);
  });

  it('updates generation settings without dropping existing messages', async () => {
    const chatId = 'settings-chat';
    const repository = new FileChatRepository();

    await repository.createGenericChat({
      id: chatId,
      title: 'Settings chat',
      userName: 'Tester',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await repository.appendGenericChatMessages(chatId, [
      {
        role: 'user',
        content: 'Keep me.',
        createdAt: '2026-01-01T00:00:01.000Z',
      },
    ]);

    const updatedSession = await repository.updateGenericChatGenerationSettings(
      chatId,
      {
        samplerPresetId: 'default',
        systemPrompt: 'Chat prompt.',
        sampling: {
          contextTrimStrategy: 'trim_start',
          maxContextLength: 2048,
          maxTokens: 300,
          minP: null,
          presencePenalty: null,
          repeatPenalty: null,
          repeatPenaltyRange: null,
          temperature: 0.4,
          topK: null,
          topP: null,
        },
      },
      '2026-01-01T00:00:02.000Z',
    );

    expect(updatedSession?.messages.map((message) => message.content)).toEqual(['Keep me.']);
    expect(updatedSession?.generationSettings).toMatchObject({
      samplerPresetId: 'default',
      systemPrompt: 'Chat prompt.',
      sampling: {
        contextTrimStrategy: 'trim_start',
        maxContextLength: 2048,
        maxTokens: 300,
        temperature: 0.4,
      },
    });
    expect(updatedSession?.chat.updatedAt).toBe('2026-01-01T00:00:02.000Z');

    const chatFilePath = resolveChatFilePath(chatId);
    const rawLines = (await fs.readFile(chatFilePath, 'utf8')).split(/\r?\n/u).filter((line) => line.trim().length > 0);
    const parsedHeader = JSON.parse(rawLines[0] ?? '{}') as Record<string, unknown>;

    expect(rawLines).toHaveLength(2);
    expect(parsedHeader.generation_settings).toMatchObject({
      sampler_preset_id: 'default',
      system_prompt: 'Chat prompt.',
    });

    const directoryEntries = await fs.readdir(path.dirname(chatFilePath));
    expect(directoryEntries.filter((entry) => entry.endsWith('.tmp'))).toEqual([]);
  });
});
