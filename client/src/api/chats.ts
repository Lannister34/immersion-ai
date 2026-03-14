import { apiPost } from './client';

export interface ChatFileInfo {
  file_name: string;
  file_size: string;
  chat_items: number;
  mes: string;
  last_mes: string;
}

export interface AllChatsItem {
  characterAvatar: string;
  characterName: string;
  chatFile: string;
  lastMessage: string;
  lastDate: string;
  messageCount: number;
  fileSize: number;
}

export async function getChatMessages(
  avatarUrl: string,
  chatId: string,
): Promise<Record<string, unknown>[]> {
  return apiPost<Record<string, unknown>[]>('/api/chats/get', {
    avatar_url: avatarUrl,
    file_name: chatId,
  });
}

export async function saveChat(
  avatarUrl: string,
  chatId: string,
  chat: Record<string, unknown>[],
): Promise<void> {
  await apiPost('/api/chats/save', {
    avatar_url: avatarUrl,
    file_name: chatId,
    chat,
    force: true,
  });
}

export async function getCharacterChats(
  avatarUrl: string,
): Promise<ChatFileInfo[]> {
  const result = await apiPost<ChatFileInfo[] | { error: boolean }>('/api/characters/chats', { avatar_url: avatarUrl });
  if (!Array.isArray(result)) return [];
  return result;
}

export async function getAllChats(): Promise<AllChatsItem[]> {
  return apiPost<AllChatsItem[]>('/api/chats/all', {});
}

export async function createNewChat(
  avatarUrl: string,
  characterName: string,
  firstMessage: string,
): Promise<string> {
  const chatId = `${Date.now()}`;
  const header = { chat_metadata: {}, user_name: '', character_name: characterName };
  const firstMsg = firstMessage
    ? {
        name: characterName,
        is_user: false,
        mes: firstMessage,
        send_date: new Date().toISOString(),
        extra: {},
      }
    : null;
  const chat = firstMsg ? [header, firstMsg] : [header];
  await saveChat(avatarUrl, chatId, chat);
  return chatId;
}

export async function deleteChat(avatarUrl: string, fileName: string): Promise<void> {
  await apiPost('/api/chats/delete', { avatar_url: avatarUrl, file_name: fileName });
}
