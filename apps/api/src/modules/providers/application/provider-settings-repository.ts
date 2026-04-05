import path from 'node:path';
import type { UpdateProviderSettingsCommand } from '@immersion/contracts/providers';
import { resolveDataRoot } from '../../../lib/data-root.js';
import { readJsonFile, writeJsonFile } from '../../../lib/json-file.js';
import { normalizeStoredProviderSettings, type StoredUserSettingsRecord } from '../domain/provider-settings.js';

export class ProviderSettingsRepository {
  private readonly userSettingsPath = path.join(resolveDataRoot(), 'user-settings.json');

  async read() {
    const stored = await readJsonFile<StoredUserSettingsRecord>(this.userSettingsPath);

    return normalizeStoredProviderSettings(stored);
  }

  async write(next: UpdateProviderSettingsCommand) {
    const existing = (await readJsonFile<StoredUserSettingsRecord>(this.userSettingsPath)) ?? {};

    await writeJsonFile(this.userSettingsPath, {
      ...existing,
      backendMode: next.mode,
      activeProvider: next.activeProvider,
      providerConfigs: next.providerConfigs,
    });
  }
}
