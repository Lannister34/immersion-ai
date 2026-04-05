import { type SettingsOverviewResponse, SettingsOverviewResponseSchema } from '@immersion/contracts/settings';

import { readLegacyUserSettingsSource } from '../../../shared/infrastructure/legacy-settings-source.js';

function getString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function getBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function getUiLanguage(value: unknown) {
  return value === 'en' ? 'en' : 'ru';
}

function getResponseLanguage(value: unknown) {
  return value === 'en' || value === 'none' ? value : 'ru';
}

export function getSettingsOverview(): SettingsOverviewResponse {
  const source = readLegacyUserSettingsSource();

  const samplerPresets = Array.isArray(source.samplerPresets) ? source.samplerPresets : [];
  const presets = samplerPresets.flatMap((preset) => {
    if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {
      return [];
    }

    const candidate = preset as Record<string, unknown>;
    const id = getString(candidate.id);
    const name = getString(candidate.name);
    const maxContextLength = typeof candidate.max_context_length === 'number' ? candidate.max_context_length : 0;

    if (!id || !name) {
      return [];
    }

    return [{ id, name, maxContextLength }];
  });

  const modelPresetMap =
    source.modelPresetMap && typeof source.modelPresetMap === 'object' && !Array.isArray(source.modelPresetMap)
      ? (source.modelPresetMap as Record<string, unknown>)
      : {};

  return SettingsOverviewResponseSchema.parse({
    profile: {
      userName: getString(source.userName, 'User'),
      userPersona: getString(source.userPersona),
      systemPromptTemplate: getString(source.systemPromptTemplate),
      uiLanguage: getUiLanguage(source.uiLanguage),
      responseLanguage: getResponseLanguage(source.responseLanguage),
      streamingEnabled: getBoolean(source.streamingEnabled, true),
      thinkingEnabled: getBoolean(source.thinkingEnabled, true),
    },
    sampler: {
      activePresetId: getString(source.activePresetId, presets[0]?.id ?? 'default'),
      presets,
      modelBindingCount: Object.keys(modelPresetMap).length,
    },
  });
}
