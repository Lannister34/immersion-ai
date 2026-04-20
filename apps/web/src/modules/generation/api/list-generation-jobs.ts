import { ChatIdSchema } from '@immersion/contracts/chats';
import { ListGenerationJobsResponseSchema } from '@immersion/contracts/generation';

import { apiGet } from '../../../shared/api/client';

interface ListGenerationJobsQuery {
  chatId?: string;
}

export function listGenerationJobs(query: ListGenerationJobsQuery = {}) {
  const searchParams = new URLSearchParams();

  if (query.chatId) {
    searchParams.set('chatId', ChatIdSchema.parse(query.chatId));
  }

  const queryString = searchParams.toString();

  return apiGet(`/api/generation/jobs${queryString ? `?${queryString}` : ''}`, ListGenerationJobsResponseSchema);
}
