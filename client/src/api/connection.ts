import { getActiveProviderConfig, useAppStore } from '@/stores';
import { apiPost } from './client';

export async function getConnectionStatus(): Promise<{ connected: boolean; model: string }> {
  try {
    const state = useAppStore.getState();
    const { backendMode, llmServerConfig } = state;
    const config = getActiveProviderConfig(state);

    const rawUrl = backendMode === 'builtin' ? `http://127.0.0.1:${llmServerConfig.port}` : config.url;

    const data = await apiPost<{ model: string; koboldCppVersion: string }>('/api/backends/kobold/status', {
      api_server: rawUrl,
      api_key: config.apiKey,
    });
    const model = data.model === 'no_connection' ? '' : data.model;
    return { connected: !!model, model: model || '' };
  } catch {
    return { connected: false, model: '' };
  }
}
