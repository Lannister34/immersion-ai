import type { WorldInfo } from '@/types';
import { apiPost } from './client';

export async function getWorlds(): Promise<string[]> {
  const data = await apiPost<Array<{ file_id: string; name: string }>>('/api/worldinfo/list', {});
  return data.map((w) => w.name);
}

export async function getWorldInfo(name: string): Promise<WorldInfo> {
  return apiPost<WorldInfo>('/api/worldinfo/get', { name });
}

export async function saveWorldInfo(name: string, data: WorldInfo): Promise<void> {
  await apiPost('/api/worldinfo/edit', { name, data });
}

export async function deleteWorldInfo(name: string): Promise<void> {
  await apiPost('/api/worldinfo/delete', { name });
}
