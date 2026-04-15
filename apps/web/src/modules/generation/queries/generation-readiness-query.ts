import { queryOptions } from '@tanstack/react-query';

import { getGenerationReadiness } from '../api/get-generation-readiness';

export const generationReadinessQueryKey = ['generation', 'readiness'] as const;

export function generationReadinessQueryOptions() {
  return queryOptions({
    queryKey: generationReadinessQueryKey,
    queryFn: getGenerationReadiness,
    refetchInterval: 2500,
  });
}
