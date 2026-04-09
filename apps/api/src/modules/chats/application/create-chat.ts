import crypto from 'node:crypto';

import { type CreateChatCommand, type CreateChatResponse, CreateChatResponseSchema } from '@immersion/contracts/chats';

import { FileChatRepository } from '../infrastructure/file-chat-repository.js';
import { getDefaultUserName } from './default-user-name.js';

export async function createChat(command: CreateChatCommand): Promise<CreateChatResponse> {
  const chatRepository = new FileChatRepository();
  const summary = await chatRepository.createGenericChat({
    id: crypto.randomUUID(),
    title: command.title?.trim() || 'Новый чат',
    createdAt: new Date().toISOString(),
    userName: getDefaultUserName(),
  });

  return CreateChatResponseSchema.parse({
    chat: summary,
  });
}
