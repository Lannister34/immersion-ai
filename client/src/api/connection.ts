import { apiPost } from './client';

export async function getConnectionStatus(): Promise<{ connected: boolean; model: string }> {
  try {
    const settings = await apiPost<Record<string, unknown>>('/api/settings/get', {});
    const textGen = settings?.textgenerationwebui as Record<string, unknown> | undefined;
    const urls = textGen?.server_urls as Record<string, string> | undefined;
    const rawUrl = urls?.koboldcpp ?? 'http://127.0.0.1:5001';

    const { backendMode } = await import('@/stores').then((m) => m.useAppStore.getState());
    const apiServer = backendMode === 'builtin' ? rawUrl : rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`;

    const data = await apiPost<{ model: string; koboldCppVersion: string }>('/api/backends/kobold/status', {
      api_server: apiServer,
    });
    const model = data.model === 'no_connection' ? '' : data.model;
    return { connected: !!model, model: model || '' };
  } catch {
    return { connected: false, model: '' };
  }
}
