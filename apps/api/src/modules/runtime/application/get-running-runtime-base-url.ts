import { getState } from '../../../lib/llm-process.js';

export function getRunningRuntimeBaseUrl() {
  const state = getState();

  return state.status === 'running' ? `http://127.0.0.1:${state.port}` : null;
}
