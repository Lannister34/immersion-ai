import { z } from 'zod';

export const ChatIdSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);
export type ChatId = z.infer<typeof ChatIdSchema>;

export const ChatMessageRoleSchema = z.enum(['user', 'assistant', 'system']);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

export const ChatSummaryDtoSchema = z.object({
  id: ChatIdSchema,
  title: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  messageCount: z.number().int().nonnegative(),
  lastMessagePreview: z.string().nullable(),
  characterName: z.string().nullable(),
});
export type ChatSummaryDto = z.infer<typeof ChatSummaryDtoSchema>;

export const ChatMessageDtoSchema = z.object({
  id: z.string().min(1),
  role: ChatMessageRoleSchema,
  content: z.string(),
  createdAt: z.string().min(1),
});
export type ChatMessageDto = z.infer<typeof ChatMessageDtoSchema>;

export const ChatSessionDtoSchema = z.object({
  chat: ChatSummaryDtoSchema,
  userName: z.string(),
  characterName: z.string().nullable(),
  messages: z.array(ChatMessageDtoSchema),
});
export type ChatSessionDto = z.infer<typeof ChatSessionDtoSchema>;

export const ChatListResponseSchema = z.object({
  items: z.array(ChatSummaryDtoSchema),
});
export type ChatListResponse = z.infer<typeof ChatListResponseSchema>;

export const CreateChatCommandSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});
export type CreateChatCommand = z.infer<typeof CreateChatCommandSchema>;

export const CreateChatResponseSchema = z.object({
  chat: ChatSummaryDtoSchema,
});
export type CreateChatResponse = z.infer<typeof CreateChatResponseSchema>;

export const GetChatSessionResponseSchema = ChatSessionDtoSchema;
export type GetChatSessionResponse = z.infer<typeof GetChatSessionResponseSchema>;
