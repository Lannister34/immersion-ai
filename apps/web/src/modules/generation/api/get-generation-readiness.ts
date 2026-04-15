import { GenerationReadinessResponseSchema } from '@immersion/contracts/generation';

import { apiGet } from '../../../shared/api/client';

export function getGenerationReadiness() {
  return apiGet('/api/generation/readiness', GenerationReadinessResponseSchema);
}
