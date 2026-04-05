import { ProvidersOverviewResponseSchema } from '@immersion/contracts/providers';

import { apiGet } from '../../../shared/api/client';

export function getProvidersOverview() {
  return apiGet('/api/providers/overview', ProvidersOverviewResponseSchema);
}
