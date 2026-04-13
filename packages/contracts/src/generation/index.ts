import { z } from 'zod';

import { ChatIdSchema, ChatSessionDtoSchema } from '../chats/index.js';

export const StartChatReplyGenerationCommandSchema = z.object({
  chatId: ChatIdSchema,
  message: z.string().trim().min(1).max(20_000),
});
export type StartChatReplyGenerationCommand = z.infer<typeof StartChatReplyGenerationCommandSchema>;

export const ChatReplyGenerationResponseSchema = z.object({
  session: ChatSessionDtoSchema,
});
export type ChatReplyGenerationResponse = z.infer<typeof ChatReplyGenerationResponseSchema>;
