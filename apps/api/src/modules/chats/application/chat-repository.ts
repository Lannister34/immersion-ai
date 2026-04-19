import type {
  AppendChatMessageInput,
  ChatGenerationSettingsRecord,
  ChatSessionRecord,
  ChatSummaryRecord,
  CreateGenericChatInput,
} from './chat-records.js';

export interface ChatRepository {
  appendGenericChatMessages(chatId: string, messages: AppendChatMessageInput[]): Promise<ChatSessionRecord | null>;
  createGenericChat(input: CreateGenericChatInput): Promise<ChatSummaryRecord>;
  getGenericChatSession(chatId: string): Promise<ChatSessionRecord | null>;
  listGenericChats(): Promise<ChatSummaryRecord[]>;
  updateGenericChatGenerationSettings(
    chatId: string,
    settings: ChatGenerationSettingsRecord,
    updatedAt: string,
  ): Promise<ChatSessionRecord | null>;
}
