import type { Character } from '@/types';
import { apiPost, getCsrfToken } from './client';

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

export async function createCharacter(
  character: Omit<Character, 'avatar'>,
  avatarFile?: File,
): Promise<void> {
  const token = await getCsrfToken();
  const form = new FormData();
  form.append('ch_name', character.name);
  form.append('description', character.description);
  form.append('personality', character.personality);
  form.append('mes_example', character.mes_example);
  if (character.system_prompt) form.append('system_prompt', character.system_prompt);
  if (character.tags?.length) form.append('tags', character.tags.join(', '));
  if (character.world) form.append('world', character.world);
  if (avatarFile) form.append('avatar', avatarFile);

  const res = await fetch('/api/characters/create', {
    method: 'POST',
    headers: { 'x-csrf-token': token },
    body: form,
  });
  if (!res.ok) {
    let msg = `Ошибка сервера (${res.status})`;
    try {
      const data = await res.json() as { error?: string };
      if (data?.error) msg = data.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
}

export async function editCharacter(
  avatarUrl: string,
  character: Partial<Character>,
  avatarFile?: File,
): Promise<void> {
  const token = await getCsrfToken();
  const form = new FormData();
  form.append('avatar_url', avatarUrl);
  form.append('ch_name', character.name ?? '');
  form.append('description', character.description ?? '');
  form.append('personality', character.personality ?? '');
  form.append('mes_example', character.mes_example ?? '');
  if (character.tags?.length) form.append('tags', character.tags.join(', '));
  if (character.world !== undefined) form.append('world', character.world ?? '');
  if (avatarFile) form.append('avatar', avatarFile);

  const res = await fetch('/api/characters/edit', {
    method: 'POST',
    headers: { 'x-csrf-token': token },
    body: form,
  });
  if (!res.ok) {
    let msg = `Ошибка сервера (${res.status})`;
    try {
      const data = await res.json() as { error?: string };
      if (data?.error) msg = data.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
}

export async function deleteCharacter(
  avatarUrl: string,
  deleteChats = true,
): Promise<void> {
  await apiPost('/api/characters/delete', {
    avatar_url: avatarUrl,
    delete_chats: deleteChats,
  });
}
