import { z } from 'zod';

import { getRunningRuntimeBaseUrl } from '../../runtime/application/get-running-runtime-base-url.js';
import { getProviderSettings } from './get-provider-settings.js';

const DEFAULT_OPENAI_COMPATIBLE_MODEL = 'local-model';

export class GenerationProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationProviderUnavailableError';
  }
}

export interface GenerationProviderEndpoint {
  apiKey: string | null;
  baseUrl: string;
  model: string;
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/u, '');
}

function normalizeBaseUrl(value: string) {
  const trimmed = trimTrailingSlashes(value.trim());

  if (!trimmed) {
    throw new GenerationProviderUnavailableError('Provider URL is empty.');
  }

  try {
    return trimTrailingSlashes(new URL(trimmed).toString());
  } catch {
    throw new GenerationProviderUnavailableError(`Provider URL is invalid: ${value}`);
  }
}

export function resolveChatCompletionsUrl(endpoint: GenerationProviderEndpoint) {
  const normalized = normalizeBaseUrl(endpoint.baseUrl);

  return normalized.endsWith('/v1') ? `${normalized}/chat/completions` : `${normalized}/v1/chat/completions`;
}

export async function resolveGenerationProviderEndpoint(): Promise<GenerationProviderEndpoint> {
  const settings = await getProviderSettings();

  if (settings.mode === 'builtin') {
    const runtimeBaseUrl = getRunningRuntimeBaseUrl();

    if (!runtimeBaseUrl) {
      throw new GenerationProviderUnavailableError('Встроенный сервер не запущен.');
    }

    return {
      apiKey: null,
      baseUrl: runtimeBaseUrl,
      model: DEFAULT_OPENAI_COMPATIBLE_MODEL,
    };
  }

  const config = settings.providerConfigs[settings.activeProvider];
  const parsedConfig = z
    .object({
      apiKey: z.string().min(1).optional(),
      url: z.string().min(1),
    })
    .parse(config);

  return {
    apiKey: parsedConfig.apiKey ?? null,
    baseUrl: parsedConfig.url,
    model: DEFAULT_OPENAI_COMPATIBLE_MODEL,
  };
}
