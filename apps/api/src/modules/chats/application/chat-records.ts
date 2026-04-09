export type ChatMessageRoleRecord = 'assistant' | 'system' | 'user';

export interface ChatMessageRecord {
  content: string;
  createdAt: string;
  id: string;
  role: ChatMessageRoleRecord;
}

export interface ChatSummaryRecord {
  characterName: string | null;
  createdAt: string;
  id: string;
  lastMessagePreview: string | null;
  messageCount: number;
  title: string;
  updatedAt: string;
}

export interface ChatSessionRecord {
  characterName: string | null;
  chat: ChatSummaryRecord;
  messages: ChatMessageRecord[];
  userName: string | null;
}

export interface CreateGenericChatInput {
  createdAt: string;
  id: string;
  title: string;
  userName: string;
}
