import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveDataRoot } from '../../../lib/data-root.js';
import type {
  AppendChatMessageInput,
  ChatMessageRecord,
  ChatMessageRoleRecord,
  ChatSessionRecord,
  ChatSummaryRecord,
  CreateGenericChatInput,
} from '../application/chat-records.js';
import type { ChatRepository } from '../application/chat-repository.js';

// MVP scope: rewrite chats are generic-only until the character-backed slice lands.
const GENERIC_CHAT_DIRECTORY = '_no_character_';
const DEFAULT_CHAT_TITLE_PREFIX = 'Новый чат';

interface StoredChatMetadata {
  createdAt?: string;
  title?: string;
  updatedAt?: string;
}

interface StoredChatHeader {
  chat_metadata?: StoredChatMetadata;
  character_name?: string;
  user_name?: string;
}

interface StoredChatLine {
  extra?: unknown;
  is_user?: boolean;
  mes?: string;
  send_date?: string;
}

function getString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function resolveChatsDirectory() {
  return path.join(resolveDataRoot(), 'chats', GENERIC_CHAT_DIRECTORY);
}

function resolveChatFilePath(chatId: string) {
  return path.join(resolveChatsDirectory(), `${chatId}.jsonl`);
}

function parseJsonRecord(line: string, filePath: string, lineNumber: number) {
  if (!line.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`Malformed chat file: ${filePath}:${lineNumber}`);
  }
}

function parseStoredHeader(line: string, filePath: string) {
  const parsed = parseJsonRecord(line, filePath, 1);
  if (!parsed) {
    return null;
  }

  if (!('chat_metadata' in parsed) && !('user_name' in parsed) && !('character_name' in parsed)) {
    return null;
  }

  const metadataSource =
    parsed.chat_metadata && typeof parsed.chat_metadata === 'object' && !Array.isArray(parsed.chat_metadata)
      ? (parsed.chat_metadata as Record<string, unknown>)
      : {};

  return {
    chat_metadata: {
      createdAt: getString(metadataSource.createdAt),
      title: getString(metadataSource.title),
      updatedAt: getString(metadataSource.updatedAt),
    },
    character_name: getString(parsed.character_name),
    user_name: getString(parsed.user_name),
  } satisfies StoredChatHeader;
}

function parseStoredHeaderRecord(line: string, filePath: string) {
  const parsed = parseJsonRecord(line, filePath, 1);
  if (!parsed) {
    return null;
  }

  if (!('chat_metadata' in parsed) && !('user_name' in parsed) && !('character_name' in parsed)) {
    return null;
  }

  return parsed;
}

function parseStoredChatLine(line: string, filePath: string, lineNumber: number) {
  const parsed = parseJsonRecord(line, filePath, lineNumber);
  if (!parsed) {
    return null;
  }
  if ('chat_metadata' in parsed) {
    throw new Error(`Unexpected chat header outside first line: ${filePath}:${lineNumber}`);
  }

  return {
    extra: parsed.extra,
    is_user: parsed.is_user === true,
    mes: getString(parsed.mes),
    send_date: getString(parsed.send_date),
  } satisfies StoredChatLine;
}

function getMessageRole(line: StoredChatLine): ChatMessageRoleRecord {
  if (line.extra && typeof line.extra === 'object' && !Array.isArray(line.extra)) {
    const extraSource = line.extra as Record<string, unknown>;
    if (extraSource.type === 'system') {
      return 'system';
    }
  }

  return line.is_user ? 'user' : 'assistant';
}

function createStoredChatLine(message: AppendChatMessageInput): StoredChatLine {
  if (message.role === 'system') {
    return {
      extra: {
        type: 'system',
      },
      is_user: false,
      mes: message.content,
      send_date: message.createdAt,
    };
  }

  return {
    is_user: message.role === 'user',
    mes: message.content,
    send_date: message.createdAt,
  };
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function updateHeaderRecord(
  existingHeader: Record<string, unknown> | null,
  session: ChatSessionRecord,
  updatedAt: string,
) {
  const header = existingHeader ?? {};
  const metadata = getRecord(header.chat_metadata);

  return {
    ...header,
    chat_metadata: {
      ...metadata,
      createdAt: getString(metadata.createdAt, session.chat.createdAt),
      title: getString(metadata.title, session.chat.title),
      updatedAt,
    },
    character_name: getString(header.character_name, session.characterName ?? ''),
    user_name: getString(header.user_name, session.userName ?? ''),
  } satisfies StoredChatHeader;
}

function getFallbackTitle(chatId: string, messages: ChatMessageRecord[]) {
  const firstMessage = messages.find((message) => message.content.trim().length > 0);

  if (firstMessage) {
    return firstMessage.content.slice(0, 80);
  }

  return `${DEFAULT_CHAT_TITLE_PREFIX} ${chatId.slice(0, 8)}`;
}

async function readChatFile(chatId: string): Promise<ChatSessionRecord | null> {
  const filePath = resolveChatFilePath(chatId);
  let rawContent: string;
  let stats: Awaited<ReturnType<typeof fs.stat>>;

  try {
    [rawContent, stats] = await Promise.all([fs.readFile(filePath, 'utf8'), fs.stat(filePath)]);
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException;
    if (candidate.code === 'ENOENT') {
      return null;
    }

    throw error;
  }

  const lines = rawContent
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error(`Empty chat file: ${filePath}`);
  }

  const header = parseStoredHeader(lines[0] ?? '', filePath);
  const messageLines = lines.slice(header ? 1 : 0);
  const fallbackCreatedAt = stats.birthtimeMs > 0 ? stats.birthtime.toISOString() : stats.mtime.toISOString();
  const messages = messageLines.flatMap((line, index) => {
    const storedLine = parseStoredChatLine(line, filePath, (header ? 2 : 1) + index);
    if (!storedLine) {
      return [];
    }

    return [
      {
        id: `${chatId}:${index + 1}`,
        role: getMessageRole(storedLine),
        content: storedLine.mes ?? '',
        createdAt: storedLine.send_date || fallbackCreatedAt,
      } satisfies ChatMessageRecord,
    ];
  });
  const updatedAt =
    messages.at(-1)?.createdAt ?? (getString(header?.chat_metadata?.updatedAt).trim() || stats.mtime.toISOString());
  const createdAt = getString(header?.chat_metadata?.createdAt).trim() || fallbackCreatedAt;
  const title = getString(header?.chat_metadata?.title).trim() || getFallbackTitle(chatId, messages);
  const summary: ChatSummaryRecord = {
    id: chatId,
    title,
    createdAt,
    updatedAt,
    messageCount: messages.length,
    lastMessagePreview: messages.at(-1)?.content.slice(0, 160) ?? null,
    characterName: getString(header?.character_name).trim() || null,
  };

  return {
    chat: summary,
    userName: getString(header?.user_name) || null,
    characterName: summary.characterName,
    messages,
  };
}

export class FileChatRepository implements ChatRepository {
  async appendGenericChatMessages(chatId: string, messages: AppendChatMessageInput[]) {
    const currentSession = await readChatFile(chatId);

    if (!currentSession) {
      return null;
    }

    if (messages.length === 0) {
      return currentSession;
    }

    const filePath = resolveChatFilePath(chatId);
    const rawContent = await fs.readFile(filePath, 'utf8');
    const lines = rawContent
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const existingHeader = lines[0] ? parseStoredHeaderRecord(lines[0], filePath) : null;
    const existingMessageLines = existingHeader ? lines.slice(1) : lines;
    const updatedAt = messages[messages.length - 1]!.createdAt;
    const nextLines = [
      JSON.stringify(updateHeaderRecord(existingHeader, currentSession, updatedAt)),
      ...existingMessageLines,
      ...messages.map((message) => JSON.stringify(createStoredChatLine(message))),
    ];

    await fs.writeFile(filePath, `${nextLines.join('\n')}\n`, 'utf8');

    return readChatFile(chatId);
  }

  async createGenericChat(input: CreateGenericChatInput): Promise<ChatSummaryRecord> {
    const header: StoredChatHeader = {
      chat_metadata: {
        createdAt: input.createdAt,
        title: input.title,
        updatedAt: input.createdAt,
      },
      user_name: input.userName,
      character_name: '',
    };

    await fs.mkdir(resolveChatsDirectory(), { recursive: true });
    await fs.writeFile(resolveChatFilePath(input.id), `${JSON.stringify(header)}\n`, 'utf8');

    return {
      id: input.id,
      title: input.title,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      messageCount: 0,
      lastMessagePreview: null,
      characterName: null,
    };
  }

  async getGenericChatSession(chatId: string) {
    return readChatFile(chatId);
  }

  async listGenericChats(): Promise<ChatSummaryRecord[]> {
    let entries: string[];

    try {
      entries = await fs.readdir(resolveChatsDirectory());
    } catch (error) {
      const candidate = error as NodeJS.ErrnoException;
      if (candidate.code === 'ENOENT') {
        return [];
      }

      throw error;
    }

    const sessions = await Promise.all(
      entries.filter((entry) => entry.endsWith('.jsonl')).map(async (entry) => readChatFile(path.parse(entry).name)),
    );

    return sessions
      .flatMap((session) => (session ? [session.chat] : []))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
}
