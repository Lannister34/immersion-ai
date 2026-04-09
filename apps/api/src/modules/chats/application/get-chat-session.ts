import { type GetChatSessionResponse, GetChatSessionResponseSchema } from '@immersion/contracts/chats';

import { FileChatRepository } from '../infrastructure/file-chat-repository.js';
import { getDefaultUserName } from './default-user-name.js';

export async function getChatSession(chatId: string): Promise<GetChatSessionResponse | null> {
  const chatRepository = new FileChatRepository();
  const session = await chatRepository.getGenericChatSession(chatId);
  if (!session) {
    return null;
  }

  return GetChatSessionResponseSchema.parse({
    ...session,
    userName: session.userName ?? getDefaultUserName(),
  });
}
