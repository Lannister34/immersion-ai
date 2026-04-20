import { GenerationJobIdSchema, GenerationJobResponseSchema } from '@immersion/contracts/generation';
import { z } from 'zod';

import { apiPost } from '../../../shared/api/client';

const CancelGenerationJobCommandSchema = z.object({
  jobId: GenerationJobIdSchema,
});

type CancelGenerationJobCommand = z.infer<typeof CancelGenerationJobCommandSchema>;

export function cancelGenerationJob(command: CancelGenerationJobCommand) {
  const payload = CancelGenerationJobCommandSchema.parse(command);

  return apiPost(
    `/api/generation/jobs/${encodeURIComponent(payload.jobId)}/cancel`,
    {},
    z.object({}),
    GenerationJobResponseSchema,
  );
}
