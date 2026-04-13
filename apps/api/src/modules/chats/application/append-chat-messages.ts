import type { ChatSessionDto } from '@immersion/contracts/chats';
import { FileChatRepository } from '../infrastructure/file-chat-repository.js';
import type { AppendChatMessageInput } from './chat-records.js';
import { toChatSessionResponse } from './chat-session-response.js';

export class ChatNotFoundError extends Error {
  constructor(chatId: string) {
    super(`Chat session not found: ${chatId}`);
    this.name = 'ChatNotFoundError';
  }
}

export async function appendChatMessages(chatId: string, messages: AppendChatMessageInput[]): Promise<ChatSessionDto> {
  const chatRepository = new FileChatRepository();
  const session = await chatRepository.appendGenericChatMessages(chatId, messages);

  if (!session) {
    throw new ChatNotFoundError(chatId);
  }

  return toChatSessionResponse(session);
}
