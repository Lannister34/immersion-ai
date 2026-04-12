import fs from 'node:fs';
import path from 'node:path';

import {
  type RuntimeModelSummary,
  type RuntimeOverviewResponse,
  RuntimeOverviewResponseSchema,
} from '@immersion/contracts/runtime';

import { resolveDataRoot } from '../../../lib/data-root.js';
import { getEngineInfo, getState } from '../../../lib/llm-process.js';
import { readLegacyUserSettingsSource } from '../../../shared/infrastructure/legacy-settings-source.js';
import { normalizeRuntimeConfig } from './runtime-config.js';

function scanModels(modelsDirs: string[]): RuntimeModelSummary[] {
  const models: RuntimeModelSummary[] = [];
  const seenPaths = new Set<string>();

  for (const modelsDir of modelsDirs) {
    if (!fs.existsSync(modelsDir)) {
      continue;
    }

    const entries = fs.readdirSync(modelsDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(modelsDir, entry.name);

      if (entry.isFile() && entry.name.endsWith('.gguf') && !seenPaths.has(entryPath)) {
        seenPaths.add(entryPath);
        const stats = fs.statSync(entryPath);
        models.push({
          name: entry.name,
          path: entryPath,
          size: stats.size,
          sourceDirectory: modelsDir,
        });
      }

      if (!entry.isDirectory()) {
        continue;
      }

      try {
        const nestedEntries = fs.readdirSync(entryPath, { withFileTypes: true });

        for (const nestedEntry of nestedEntries) {
          if (!nestedEntry.isFile() || !nestedEntry.name.endsWith('.gguf')) {
            continue;
          }

          const nestedPath = path.join(entryPath, nestedEntry.name);
          if (seenPaths.has(nestedPath)) {
            continue;
          }

          seenPaths.add(nestedPath);
          const stats = fs.statSync(nestedPath);
          models.push({
            name: `${entry.name}/${nestedEntry.name}`,
            path: nestedPath,
            size: stats.size,
            sourceDirectory: modelsDir,
          });
        }
      } catch {}
    }
  }

  return models.sort((left, right) => left.name.localeCompare(right.name));
}

export function getRuntimeOverview(): RuntimeOverviewResponse {
  const source = readLegacyUserSettingsSource();
  const engine = getEngineInfo();
  const serverStatus = getState();
  const runtimeConfig = normalizeRuntimeConfig(source.llmServerConfig);
  const modelsDirs = runtimeConfig.modelsDirs.map((directory) => {
    if (path.isAbsolute(directory)) {
      return directory;
    }

    return path.resolve(resolveDataRoot(), directory);
  });

  return RuntimeOverviewResponseSchema.parse({
    engine,
    serverStatus,
    serverConfig: {
      ...runtimeConfig,
      modelsDirs,
    },
    models: scanModels(modelsDirs),
  });
}
