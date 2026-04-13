import { queryOptions } from '@tanstack/react-query';

import { getChatSession } from '../api/get-chat-session';

export function chatSessionQueryKey(chatId: string) {
  return ['chats', 'session', chatId] as const;
}

export function chatSessionQueryOptions(chatId: string) {
  return queryOptions({
    queryKey: chatSessionQueryKey(chatId),
    queryFn: () => getChatSession(chatId),
  });
}
