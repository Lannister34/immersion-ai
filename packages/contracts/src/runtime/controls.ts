import { z } from 'zod';

import { RuntimeConfigSnapshotSchema } from './overview.js';

export const RuntimeConfigCommandSchema = RuntimeConfigSnapshotSchema;
export type RuntimeConfigCommand = z.infer<typeof RuntimeConfigCommandSchema>;

export const RuntimeStartCommandSchema = RuntimeConfigCommandSchema.omit({
  modelsDirs: true,
}).extend({
  modelPath: z.string().min(1),
});
export type RuntimeStartCommand = z.infer<typeof RuntimeStartCommandSchema>;

export const RuntimeStopCommandSchema = z.object({});
export type RuntimeStopCommand = z.infer<typeof RuntimeStopCommandSchema>;

export const RuntimeActionResponseSchema = z.object({
  ok: z.literal(true),
});
export type RuntimeActionResponse = z.infer<typeof RuntimeActionResponseSchema>;
