import { queryOptions } from '@tanstack/react-query';

import { listGenerationJobs } from '../api/list-generation-jobs';

export const generationJobsQueryKey = ['generation', 'jobs'] as const;

export function chatGenerationJobsQueryKey(chatId: string) {
  return [...generationJobsQueryKey, 'chat', chatId] as const;
}

export function chatGenerationJobsQueryOptions(chatId: string) {
  return queryOptions({
    queryKey: chatGenerationJobsQueryKey(chatId),
    queryFn: () =>
      listGenerationJobs({
        chatId,
      }),
    refetchInterval: 5000,
  });
}
