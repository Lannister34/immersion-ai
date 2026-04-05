import { z } from 'zod';

import {
  type ProviderDefinition,
  ProviderDefinitionSchema,
  ProviderFieldTypeSchema,
  type ProviderMode,
  ProviderModeSchema,
  type ProviderType,
  ProviderTypeSchema,
} from './settings.js';

export const ProviderConfigFieldSnapshotSchema = z.object({
  key: z.string().min(1),
  type: ProviderFieldTypeSchema,
  hasValue: z.boolean(),
  value: z.string().nullable(),
});
export type ProviderConfigFieldSnapshot = z.infer<typeof ProviderConfigFieldSnapshotSchema>;

export const ProviderConfigSnapshotSchema = z.object({
  provider: ProviderTypeSchema,
  fields: z.array(ProviderConfigFieldSnapshotSchema),
});
export type ProviderConfigSnapshot = z.infer<typeof ProviderConfigSnapshotSchema>;

export const ProvidersOverviewResponseSchema = z.object({
  backendMode: ProviderModeSchema,
  activeProvider: ProviderTypeSchema,
  availableProviders: z.array(ProviderDefinitionSchema),
  providerConfigs: z.array(ProviderConfigSnapshotSchema),
});
export type ProvidersOverviewResponse = z.infer<typeof ProvidersOverviewResponseSchema>;

export type { ProviderDefinition, ProviderMode, ProviderType };
