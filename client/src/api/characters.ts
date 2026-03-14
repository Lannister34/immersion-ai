import type { Character } from '@/types';
import { apiPost, apiPostForm } from './client';

export async function getCharacters(): Promise<Character[]> {
  return apiPost<Character[]>('/api/characters/all', {});
}

export async function getCharacterByAvatar(avatar: string): Promise<Character | null> {
  try {
    return await apiPost<Character>('/api/characters/get-full', { avatar_url: avatar });
  } catch {
    return null;
  }
}

export async function createCharacter(character: Omit<Character, 'avatar'>, avatarFile?: File): Promise<void> {
  await apiPostForm('/api/characters/create', {
    ch_name: character.name,
    description: character.description,
    personality: character.personality,
    mes_example: character.mes_example,
    system_prompt: character.system_prompt || undefined,
    tags: character.tags,
    world: character.world || undefined,
    avatar: avatarFile,
  });
}

export async function editCharacter(
  avatarUrl: string,
  character: Partial<Character>,
  avatarFile?: File,
): Promise<void> {
  await apiPostForm('/api/characters/edit', {
    avatar_url: avatarUrl,
    ch_name: character.name ?? '',
    description: character.description ?? '',
    personality: character.personality ?? '',
    mes_example: character.mes_example ?? '',
    tags: character.tags,
    world: character.world ?? undefined,
    avatar: avatarFile,
  });
}

export async function deleteCharacter(avatarUrl: string, deleteChats = true): Promise<void> {
  await apiPost('/api/characters/delete', {
    avatar_url: avatarUrl,
    delete_chats: deleteChats,
  });
}
