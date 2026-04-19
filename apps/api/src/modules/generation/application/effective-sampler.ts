import type { ChatGenerationSettingsDto } from '@immersion/contracts/chats';
import type { SettingsOverviewResponse } from '@immersion/contracts/settings';

import {
  type ActiveSamplerPreset,
  resolveActiveSamplerPreset,
  resolveSamplerPresetForModel,
} from '../../settings/application/active-sampler-preset.js';

function resolvePresetById(settings: SettingsOverviewResponse, presetId: string | null) {
  if (!presetId) {
    return null;
  }

  return settings.sampler.presets.find((preset) => preset.id === presetId) ?? null;
}

export function resolveEffectiveSamplerPreset(
  settings: SettingsOverviewResponse,
  modelName: string | null,
  chatGenerationSettings: ChatGenerationSettingsDto,
): ActiveSamplerPreset {
  const basePreset =
    resolvePresetById(settings, chatGenerationSettings.samplerPresetId) ??
    resolveSamplerPresetForModel(settings, modelName) ??
    resolveActiveSamplerPreset(settings);
  const overrides = chatGenerationSettings.sampling;

  return {
    contextTrimStrategy: overrides.contextTrimStrategy ?? basePreset.contextTrimStrategy,
    id: basePreset.id,
    maxContextLength: overrides.maxContextLength ?? basePreset.maxContextLength,
    maxTokens: overrides.maxTokens ?? basePreset.maxTokens,
    minP: overrides.minP ?? basePreset.minP,
    name: basePreset.name,
    presencePenalty: overrides.presencePenalty ?? basePreset.presencePenalty,
    repeatPenalty: overrides.repeatPenalty ?? basePreset.repeatPenalty,
    repeatPenaltyRange: overrides.repeatPenaltyRange ?? basePreset.repeatPenaltyRange,
    temperature: overrides.temperature ?? basePreset.temperature,
    topK: overrides.topK ?? basePreset.topK,
    topP: overrides.topP ?? basePreset.topP,
  };
}
