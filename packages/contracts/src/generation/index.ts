import { z } from 'zod';

import { ChatIdSchema, ChatSessionDtoSchema } from '../chats/index.js';
import { ProviderModeSchema, ProviderTypeSchema } from '../providers/settings.js';
import { RuntimeServerStatusSchema } from '../runtime/overview.js';

export const GenerationReadinessStatusSchema = z.enum(['blocked', 'ready']);
export type GenerationReadinessStatus = z.infer<typeof GenerationReadinessStatusSchema>;

export const GenerationReadinessIssueCodeSchema = z.enum([
  'builtin_no_models',
  'builtin_runtime_error',
  'builtin_runtime_not_installed',
  'builtin_runtime_not_running',
  'builtin_runtime_starting',
  'builtin_runtime_stopping',
  'external_provider_url_invalid',
  'external_provider_url_missing',
]);
export type GenerationReadinessIssueCode = z.infer<typeof GenerationReadinessIssueCodeSchema>;

export const GenerationReadinessIssueSchema = z.object({
  code: GenerationReadinessIssueCodeSchema,
  message: z.string().min(1),
});
export type GenerationReadinessIssue = z.infer<typeof GenerationReadinessIssueSchema>;

export const GenerationReadinessRuntimeSchema = z.object({
  model: z.string().nullable(),
  port: z.number().int().nonnegative(),
  status: RuntimeServerStatusSchema,
});
export type GenerationReadinessRuntime = z.infer<typeof GenerationReadinessRuntimeSchema>;

export const GenerationReadinessResponseSchema = z.object({
  activeProvider: ProviderTypeSchema,
  issue: GenerationReadinessIssueSchema.nullable(),
  mode: ProviderModeSchema,
  runtime: GenerationReadinessRuntimeSchema.nullable(),
  status: GenerationReadinessStatusSchema,
});
export type GenerationReadinessResponse = z.infer<typeof GenerationReadinessResponseSchema>;

export const StartChatReplyGenerationCommandSchema = z.object({
  chatId: ChatIdSchema,
  message: z.string().trim().min(1).max(20_000),
});
export type StartChatReplyGenerationCommand = z.infer<typeof StartChatReplyGenerationCommandSchema>;

export const ChatReplyGenerationResponseSchema = z.object({
  session: ChatSessionDtoSchema,
});
export type ChatReplyGenerationResponse = z.infer<typeof ChatReplyGenerationResponseSchema>;
