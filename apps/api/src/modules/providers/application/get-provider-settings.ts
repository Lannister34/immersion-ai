import { toProviderSettingsSnapshot } from '../domain/provider-settings.js';
import { ProviderSettingsRepository } from './provider-settings-repository.js';

export async function getProviderSettings(repository = new ProviderSettingsRepository()) {
  return toProviderSettingsSnapshot(await repository.read());
}
