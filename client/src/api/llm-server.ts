import { apiPost } from './client';

export interface LlmStartConfig {
  modelPath: string;
  port: number;
  gpuLayers: number;
  contextSize: number;
  flashAttention: boolean;
  threads: number;
}

export interface EngineInfo {
  found: boolean;
  executablePath: string | null;
  defaultModelsDir: string;
}

export interface LlmServerStatus {
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'error';
  model: string | null;
  modelPath: string | null;
  error: string | null;
  port: number;
  pid: number | null;
}

export interface ModelFile {
  name: string;
  path: string;
  size: number;
}

export async function startLlmServer(config: LlmStartConfig): Promise<void> {
  await apiPost('/api/llm-server/start', config);
}

export async function stopLlmServer(): Promise<void> {
  await apiPost('/api/llm-server/stop', {});
}

export async function getLlmServerStatus(): Promise<LlmServerStatus> {
  const res = await fetch('/api/llm-server/status');
  return res.json() as Promise<LlmServerStatus>;
}

export async function listModelFiles(modelsDir: string): Promise<ModelFile[]> {
  const data = await apiPost<{ models: ModelFile[] }>('/api/llm-server/models', { modelsDir });
  return data.models;
}

export async function getLlmServerLogs(): Promise<string[]> {
  const res = await fetch('/api/llm-server/logs');
  const data = await res.json() as { lines: string[] };
  return data.lines;
}

export async function getEngineInfo(): Promise<EngineInfo> {
  const res = await fetch('/api/llm-server/engine');
  return res.json() as Promise<EngineInfo>;
}

export async function browseFolder(initialDir?: string): Promise<string | null> {
  const data = await apiPost<{ path: string | null }>('/api/llm-server/browse-folder', { initialDir });
  return data.path;
}

export async function browseFile(filter?: string, initialDir?: string): Promise<string | null> {
  const data = await apiPost<{ path: string | null }>('/api/llm-server/browse-file', { filter, initialDir });
  return data.path;
}
