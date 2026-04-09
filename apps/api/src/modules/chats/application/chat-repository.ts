import type { ChatSessionRecord, ChatSummaryRecord, CreateGenericChatInput } from './chat-records.js';

export interface ChatRepository {
  createGenericChat(input: CreateGenericChatInput): Promise<ChatSummaryRecord>;
  getGenericChatSession(chatId: string): Promise<ChatSessionRecord | null>;
  listGenericChats(): Promise<ChatSummaryRecord[]>;
}
