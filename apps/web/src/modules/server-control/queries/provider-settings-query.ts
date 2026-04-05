import { queryOptions } from '@tanstack/react-query';

import { getProviderSettings } from '../api/get-provider-settings';

export const providerSettingsQueryKey = ['providers', 'settings'] as const;

export function providerSettingsQueryOptions() {
  return queryOptions({
    queryKey: providerSettingsQueryKey,
    queryFn: getProviderSettings,
  });
}
