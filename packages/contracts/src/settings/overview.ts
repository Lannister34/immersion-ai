import { z } from 'zod';

export const UiLanguageSchema = z.enum(['ru', 'en']);
export const ResponseLanguageSchema = z.enum(['ru', 'en', 'none']);
export const ContextTrimStrategySchema = z.enum(['trim_middle', 'trim_start']);

export const SettingsProfileSchema = z.object({
  userName: z.string(),
  userPersona: z.string(),
  systemPromptTemplate: z.string(),
  uiLanguage: UiLanguageSchema,
  responseLanguage: ResponseLanguageSchema,
  streamingEnabled: z.boolean(),
  thinkingEnabled: z.boolean(),
});

export const SamplerPresetSummarySchema = z.object({
  contextTrimStrategy: ContextTrimStrategySchema,
  id: z.string(),
  maxContextLength: z.number().int().nonnegative(),
  maxTokens: z.number().int().positive(),
  minP: z.number().nonnegative(),
  name: z.string(),
  presencePenalty: z.number(),
  repeatPenalty: z.number().nonnegative(),
  repeatPenaltyRange: z.number().int().nonnegative(),
  temperature: z.number().nonnegative(),
  topK: z.number().int().nonnegative(),
  topP: z.number().nonnegative(),
});

export const ModelPresetBindingDtoSchema = z.object({
  modelName: z.string().min(1),
  presetId: z.string().min(1),
});

export const SettingsSamplerOverviewSchema = z.object({
  activePresetId: z.string(),
  modelBindings: z.array(ModelPresetBindingDtoSchema),
  presets: z.array(SamplerPresetSummarySchema),
  modelBindingCount: z.number().int().nonnegative(),
});

export const SettingsOverviewResponseSchema = z.object({
  profile: SettingsProfileSchema,
  sampler: SettingsSamplerOverviewSchema,
});

export type SettingsOverviewResponse = z.infer<typeof SettingsOverviewResponseSchema>;
