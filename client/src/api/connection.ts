import { getActiveConnectionPreset, useAppStore } from '@/stores';
import { apiPost } from './client';

export async function getConnectionStatus(): Promise<{ connected: boolean; model: string }> {
  try {
    const state = useAppStore.getState();
    const { backendMode, llmServerConfig } = state;
    const preset = getActiveConnectionPreset(state);

    const rawUrl = backendMode === 'builtin' ? `http://127.0.0.1:${llmServerConfig.port}` : preset.url;

    const data = await apiPost<{ model: string; koboldCppVersion: string }>('/api/backends/kobold/status', {
      api_server: rawUrl,
      api_key: preset.apiKey,
    });
    const model = data.model === 'no_connection' ? '' : data.model;
    return { connected: !!model, model: model || '' };
  } catch {
    return { connected: false, model: '' };
  }
}
