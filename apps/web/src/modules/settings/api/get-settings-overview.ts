import { SettingsOverviewResponseSchema } from '@immersion/contracts/settings';

import { apiGet } from '../../../shared/api/client';

export function getSettingsOverview() {
  return apiGet('/api/settings/overview', SettingsOverviewResponseSchema);
}
