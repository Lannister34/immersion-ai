import { GenerationJobEventSchema, GenerationJobIdSchema } from '@immersion/contracts/generation';

import { createApiUrl } from '../../../shared/api/client';

export function openGenerationJobEventSource(jobId: string) {
  const parsedJobId = GenerationJobIdSchema.parse(jobId);

  return new EventSource(createApiUrl(`/api/generation/jobs/${encodeURIComponent(parsedJobId)}/events`));
}

export function parseGenerationJobEvent(message: MessageEvent) {
  return GenerationJobEventSchema.parse(JSON.parse(String(message.data)));
}
