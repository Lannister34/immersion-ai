import path from 'node:path';

import type { RuntimeConfigCommand } from '@immersion/contracts/runtime';

import { resolveDataRoot } from '../../../lib/data-root.js';
import { readJsonFile, writeJsonFile } from '../../../lib/json-file.js';
import { normalizeRuntimeConfig } from './runtime-config.js';

interface StoredUserSettingsRecord extends Record<string, unknown> {
  llmServerConfig?: unknown;
}

export class RuntimeConfigRepository {
  private readonly userSettingsPath = path.join(resolveDataRoot(), 'user-settings.json');

  async read() {
    const stored = (await readJsonFile<StoredUserSettingsRecord>(this.userSettingsPath)) ?? {};

    return normalizeRuntimeConfig(stored.llmServerConfig);
  }

  async write(next: RuntimeConfigCommand) {
    const existing = (await readJsonFile<StoredUserSettingsRecord>(this.userSettingsPath)) ?? {};

    await writeJsonFile(this.userSettingsPath, {
      ...existing,
      llmServerConfig: next,
    });
  }
}
