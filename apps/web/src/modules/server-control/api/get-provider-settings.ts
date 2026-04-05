import { ProviderSettingsSnapshotSchema } from '@immersion/contracts/providers';

import { apiGet } from '../../../shared/api/client';

export function getProviderSettings() {
  return apiGet('/api/providers/settings', ProviderSettingsSnapshotSchema);
}
