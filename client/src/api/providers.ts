import type { ProviderDefinition } from '@/types';
import { apiGet } from './client';

export async function getProviderDefinitions(): Promise<ProviderDefinition[]> {
  return apiGet<ProviderDefinition[]>('/api/providers');
}
