import { getActiveProviderConfig, useAppStore } from '@/stores';
import type { ProviderConfig } from '@/types';
import { apiPost } from './client';

interface ConnectionCheckParams {
  url: string;
  apiKey?: string;
}

export async function getConnectionStatus(
  params?: ConnectionCheckParams,
): Promise<{ connected: boolean; model: string }> {
  try {
    let url: string;
    let apiKey: string | undefined;

    if (params) {
      url = params.url;
      apiKey = params.apiKey;
    } else {
      const state = useAppStore.getState();
      const config: ProviderConfig = getActiveProviderConfig(state);
      url = state.backendMode === 'builtin' ? `http://127.0.0.1:${state.llmServerConfig.port}` : config.url;
      apiKey = config.apiKey;
    }

    const data = await apiPost<{ model: string; koboldCppVersion: string }>('/api/backends/kobold/status', {
      api_server: url,
      api_key: apiKey,
    });
    const model = data.model === 'no_connection' ? '' : data.model;
    return { connected: !!model, model: model || '' };
  } catch {
    return { connected: false, model: '' };
  }
}
