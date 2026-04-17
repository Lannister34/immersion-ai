import path from 'node:path';

import { getState } from '../../../lib/llm-process.js';
import { getRuntimeOverview } from './get-runtime-overview.js';

export interface RunningRuntimeEndpoint {
  baseUrl: string;
  model: string | null;
}

function resolveCanonicalModelName(modelPath: string | null, fallbackModel: string | null) {
  if (!modelPath) {
    return fallbackModel;
  }

  const normalizedModelPath = path.normalize(modelPath);
  const runtimeModel = getRuntimeOverview().models.find((model) => path.normalize(model.path) === normalizedModelPath);

  return runtimeModel?.name ?? fallbackModel;
}

export function getRunningRuntimeEndpoint(): RunningRuntimeEndpoint | null {
  const state = getState();

  if (state.status !== 'running') {
    return null;
  }

  return {
    baseUrl: `http://127.0.0.1:${state.port}`,
    model: resolveCanonicalModelName(state.modelPath, state.model),
  };
}

export function getRunningRuntimeBaseUrl() {
  const endpoint = getRunningRuntimeEndpoint();

  return endpoint?.baseUrl ?? null;
}
