import { type CreateChatCommand, CreateChatCommandSchema, CreateChatResponseSchema } from '@immersion/contracts/chats';

import { apiPost } from '../../../shared/api/client';

export function createChat(command: CreateChatCommand) {
  return apiPost('/api/chats', command, CreateChatCommandSchema, CreateChatResponseSchema);
}
