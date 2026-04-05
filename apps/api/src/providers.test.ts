import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ProviderSettingsSnapshotSchema, type UpdateProviderSettingsCommand } from '@immersion/contracts/providers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApiApp } from './app.js';

describe('provider settings routes', () => {
  let dataRoot = '';

  beforeEach(async () => {
    dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'immersion-api-'));
    process.env.IMMERSION_DATA_ROOT = dataRoot;
  });

  afterEach(async () => {
    delete process.env.IMMERSION_DATA_ROOT;
    await fs.rm(dataRoot, { force: true, recursive: true });
  });

  it('reads provider settings from the canonical file-backed source', async () => {
    await fs.writeFile(
      path.join(dataRoot, 'user-settings.json'),
      JSON.stringify(
        {
          backendMode: 'external',
          activeProvider: 'custom',
          providerConfigs: {
            custom: {
              url: 'http://127.0.0.1:6001',
              apiKey: 'secret',
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/providers/settings',
    });

    expect(response.statusCode).toBe(200);
    expect(ProviderSettingsSnapshotSchema.parse(response.json())).toMatchObject({
      mode: 'external',
      activeProvider: 'custom',
      providerConfigs: {
        custom: {
          url: 'http://127.0.0.1:6001',
          apiKey: 'secret',
        },
      },
    });

    await app.close();
  });

  it('updates provider settings without overwriting unrelated user settings', async () => {
    await fs.writeFile(
      path.join(dataRoot, 'user-settings.json'),
      JSON.stringify(
        {
          userName: 'Misha',
          backendMode: 'external',
          activeProvider: 'custom',
          providerConfigs: {
            custom: {
              url: 'http://127.0.0.1:6001',
              apiKey: 'secret',
            },
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const command: UpdateProviderSettingsCommand = {
      mode: 'builtin',
      activeProvider: 'koboldcpp',
      providerConfigs: {
        koboldcpp: {
          url: 'http://127.0.0.1:5001',
        },
      },
    };

    const app = buildApiApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/providers/settings',
      payload: command,
    });

    expect(response.statusCode).toBe(200);
    expect(ProviderSettingsSnapshotSchema.parse(response.json())).toMatchObject({
      mode: 'builtin',
      activeProvider: 'koboldcpp',
      providerConfigs: {
        koboldcpp: {
          url: 'http://127.0.0.1:5001',
        },
      },
    });

    const stored = JSON.parse(await fs.readFile(path.join(dataRoot, 'user-settings.json'), 'utf8')) as Record<
      string,
      unknown
    >;

    expect(stored.userName).toBe('Misha');
    expect(stored.backendMode).toBe('builtin');
    expect(stored.activeProvider).toBe('koboldcpp');
    expect(stored.providerConfigs).toMatchObject({
      koboldcpp: {
        url: 'http://127.0.0.1:5001',
      },
    });

    await app.close();
  });

  it('returns an explicit error when the canonical source file contains invalid JSON', async () => {
    await fs.writeFile(path.join(dataRoot, 'user-settings.json'), '{ invalid json', 'utf8');

    const app = buildApiApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/providers/settings',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      code: 'internal_error',
    });

    await app.close();
  });
});
