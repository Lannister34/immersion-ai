import type { GetChatSessionResponse } from '@immersion/contracts/chats';

import { FileChatRepository } from '../infrastructure/file-chat-repository.js';
import { toChatSessionResponse } from './chat-session-response.js';

export async function getChatSession(chatId: string): Promise<GetChatSessionResponse | null> {
  const chatRepository = new FileChatRepository();
  const session = await chatRepository.getGenericChatSession(chatId);
  if (!session) {
    return null;
  }

  return toChatSessionResponse(session);
}
