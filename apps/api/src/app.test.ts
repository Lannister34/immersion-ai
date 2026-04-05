import { fileURLToPath, URL } from 'node:url';

import { HealthResponseSchema } from '@immersion/contracts';
import { ProvidersOverviewResponseSchema } from '@immersion/contracts/providers';
import { RuntimeOverviewResponseSchema } from '@immersion/contracts/runtime';
import { SettingsOverviewResponseSchema } from '@immersion/contracts/settings';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApiApp } from './app.js';

const fixtureDataRoot = fileURLToPath(new URL('../testdata/smoke-data', import.meta.url));

describe('buildApiApp', () => {
  let previousDataRoot: string | undefined;

  beforeEach(() => {
    previousDataRoot = process.env.IMMERSION_DATA_ROOT;
    process.env.IMMERSION_DATA_ROOT = fixtureDataRoot;
  });

  afterEach(() => {
    if (previousDataRoot) {
      process.env.IMMERSION_DATA_ROOT = previousDataRoot;
      return;
    }

    delete process.env.IMMERSION_DATA_ROOT;
  });

  it('serves the health contract', async () => {
    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(response.json())).toMatchObject({
      service: 'api',
      status: 'ok',
    });

    await app.close();
  });

  it('serves the settings overview contract from canonical files', async () => {
    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/settings/overview',
    });

    expect(response.statusCode).toBe(200);
    expect(SettingsOverviewResponseSchema.parse(response.json())).toMatchObject({
      profile: {
        userName: 'Тестер',
        uiLanguage: 'ru',
      },
    });

    await app.close();
  });

  it('serves the providers overview contract from canonical files', async () => {
    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/providers/overview',
    });
    const overview = ProvidersOverviewResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(overview.activeProvider).toBe('custom');
    expect(overview.backendMode).toBe('external');
    expect(overview.providerConfigs).toHaveLength(2);

    await app.close();
  });

  it('serves the runtime overview contract with scanned models', async () => {
    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/runtime/overview',
    });
    const overview = RuntimeOverviewResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(overview.serverConfig.port).toBe(5001);
    expect(overview.serverStatus.status).toBe('idle');
    expect(overview.models.map((model) => model.name)).toEqual(['nested/secondary.gguf', 'sandbox.gguf']);

    await app.close();
  });
});
