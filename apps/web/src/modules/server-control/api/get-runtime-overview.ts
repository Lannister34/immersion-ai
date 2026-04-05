import { RuntimeOverviewResponseSchema } from '@immersion/contracts/runtime';

import { apiGet } from '../../../shared/api/client';

export function getRuntimeOverview() {
  return apiGet('/api/runtime/overview', RuntimeOverviewResponseSchema);
}
