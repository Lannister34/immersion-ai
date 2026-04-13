import { ChatListResponseSchema } from '@immersion/contracts/chats';

import { apiGet } from '../../../shared/api/client';

export function listChats() {
  return apiGet('/api/chats', ChatListResponseSchema);
}
