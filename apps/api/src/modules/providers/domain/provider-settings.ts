import {
  type ProviderConfig,
  ProviderConfigsSchema,
  ProviderModeSchema,
  type ProviderSettingsSnapshot,
  ProviderSettingsSnapshotSchema,
  ProviderTypeSchema,
  type UpdateProviderSettingsCommand,
} from '@immersion/contracts/providers';
import { z } from 'zod';

import { providerDefinitions } from './provider-catalog.js';

const defaultProviderConfig: ProviderConfig = {
  url: 'http://127.0.0.1:5001',
};

const storedProviderSettingsSchema = z
  .object({
    backendMode: ProviderModeSchema.optional(),
    activeProvider: ProviderTypeSchema.optional(),
    providerConfigs: ProviderConfigsSchema.optional(),
    connectionPresets: z
      .array(
        z.object({
          id: z.string().min(1).optional(),
          provider: ProviderTypeSchema.optional(),
          url: z.string().min(1).optional(),
          apiKey: z.string().min(1).optional(),
        }),
      )
      .optional(),
    activeConnectionPresetId: z.string().min(1).optional(),
  })
  .passthrough();

export interface StoredUserSettingsRecord extends Record<string, unknown> {
  activeConnectionPresetId?: string;
  activeProvider?: string;
  backendMode?: string;
  connectionPresets?: unknown;
  providerConfigs?: unknown;
}

export function createDefaultProviderSettings(): UpdateProviderSettingsCommand {
  return {
    mode: 'builtin',
    activeProvider: 'custom',
    providerConfigs: {
      custom: defaultProviderConfig,
      koboldcpp: defaultProviderConfig,
    },
  };
}

function migrateLegacyConnectionPresets(
  settings: z.infer<typeof storedProviderSettingsSchema>,
): Partial<UpdateProviderSettingsCommand> | null {
  if (!settings.connectionPresets || settings.connectionPresets.length === 0) {
    return null;
  }

  const activePreset =
    settings.connectionPresets.find((preset) => preset.id === settings.activeConnectionPresetId) ??
    settings.connectionPresets[0];

  if (!activePreset?.url) {
    return null;
  }

  const activeProvider = activePreset.provider ?? 'custom';

  return {
    activeProvider,
    providerConfigs: {
      [activeProvider]: {
        url: activePreset.url,
        ...(activePreset.apiKey ? { apiKey: activePreset.apiKey } : {}),
      },
    },
  };
}

export function normalizeStoredProviderSettings(raw: StoredUserSettingsRecord | null): UpdateProviderSettingsCommand {
  const defaults = createDefaultProviderSettings();

  if (!raw) {
    return defaults;
  }

  const stored = storedProviderSettingsSchema.parse(raw);
  const migrated = !stored.providerConfigs ? migrateLegacyConnectionPresets(stored) : null;

  const mode = stored.backendMode ?? defaults.mode;
  const activeProvider = stored.activeProvider ?? migrated?.activeProvider ?? defaults.activeProvider;
  const providerConfigs = {
    ...defaults.providerConfigs,
    ...(migrated?.providerConfigs ?? {}),
    ...(stored.providerConfigs ?? {}),
  };

  providerConfigs[activeProvider] ??= defaultProviderConfig;

  return {
    mode,
    activeProvider,
    providerConfigs,
  };
}

export function toProviderSettingsSnapshot(command: UpdateProviderSettingsCommand): ProviderSettingsSnapshot {
  return ProviderSettingsSnapshotSchema.parse({
    ...command,
    providerDefinitions,
  });
}
