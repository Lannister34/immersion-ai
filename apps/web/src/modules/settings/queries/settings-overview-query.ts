import { queryOptions } from '@tanstack/react-query';

import { getSettingsOverview } from '../api/get-settings-overview';

export const settingsOverviewQueryKey = ['settings', 'overview'] as const;

export function settingsOverviewQueryOptions() {
  return queryOptions({
    queryKey: settingsOverviewQueryKey,
    queryFn: getSettingsOverview,
  });
}
