import {
  type ProviderSettingsSnapshot,
  ProviderSettingsSnapshotSchema,
  type UpdateProviderSettingsCommand,
  UpdateProviderSettingsCommandSchema,
} from '@immersion/contracts/providers';

import { apiPut } from '../../../shared/api/client';

export function saveProviderSettings(command: UpdateProviderSettingsCommand) {
  return apiPut<UpdateProviderSettingsCommand, ProviderSettingsSnapshot>(
    '/api/providers/settings',
    command,
    UpdateProviderSettingsCommandSchema,
    ProviderSettingsSnapshotSchema,
  );
}
