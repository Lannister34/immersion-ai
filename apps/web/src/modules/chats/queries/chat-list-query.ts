import { queryOptions } from '@tanstack/react-query';

import { listChats } from '../api/list-chats';

export const chatListQueryKey = ['chats', 'list'] as const;

export function chatListQueryOptions() {
  return queryOptions({
    queryKey: chatListQueryKey,
    queryFn: listChats,
  });
}
