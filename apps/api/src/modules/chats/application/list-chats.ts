import { type ChatListResponse, ChatListResponseSchema } from '@immersion/contracts/chats';

import { FileChatRepository } from '../infrastructure/file-chat-repository.js';

export async function listChats(): Promise<ChatListResponse> {
  const chatRepository = new FileChatRepository();

  return ChatListResponseSchema.parse({
    items: await chatRepository.listGenericChats(),
  });
}
