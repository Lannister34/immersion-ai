import type { SettingsOverviewResponse } from '@immersion/contracts/settings';

export type ActiveSamplerPreset = SettingsOverviewResponse['sampler']['presets'][number];

export function resolveActiveSamplerPreset(settings: SettingsOverviewResponse): ActiveSamplerPreset {
  const activePreset = settings.sampler.presets.find((preset) => preset.id === settings.sampler.activePresetId);

  if (activePreset) {
    return activePreset;
  }

  const fallbackPreset = settings.sampler.presets[0];

  if (!fallbackPreset) {
    throw new Error('Settings overview does not include a sampler preset.');
  }

  return fallbackPreset;
}
