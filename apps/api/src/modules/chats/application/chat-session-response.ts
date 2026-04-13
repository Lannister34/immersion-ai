import { type GetChatSessionResponse, GetChatSessionResponseSchema } from '@immersion/contracts/chats';

import type { ChatSessionRecord } from './chat-records.js';
import { getDefaultUserName } from './default-user-name.js';

export function toChatSessionResponse(session: ChatSessionRecord): GetChatSessionResponse {
  return GetChatSessionResponseSchema.parse({
    ...session,
    userName: session.userName ?? getDefaultUserName(),
  });
}
