import { z } from 'zod';

export const UiLanguageSchema = z.enum(['ru', 'en']);
export const ResponseLanguageSchema = z.enum(['ru', 'en', 'none']);

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
  id: z.string(),
  name: z.string(),
  maxContextLength: z.number().int().nonnegative(),
});

export const SettingsSamplerOverviewSchema = z.object({
  activePresetId: z.string(),
  presets: z.array(SamplerPresetSummarySchema),
  modelBindingCount: z.number().int().nonnegative(),
});

export const SettingsOverviewResponseSchema = z.object({
  profile: SettingsProfileSchema,
  sampler: SettingsSamplerOverviewSchema,
});

export type SettingsOverviewResponse = z.infer<typeof SettingsOverviewResponseSchema>;
