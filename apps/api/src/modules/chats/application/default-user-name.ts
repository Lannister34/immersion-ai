import { readLegacyUserSettingsSource } from '../../../shared/infrastructure/legacy-settings-source.js';

export function getDefaultUserName() {
  const candidate = readLegacyUserSettingsSource().userName;

  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'User';
}
