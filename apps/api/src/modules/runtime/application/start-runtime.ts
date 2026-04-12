import fs from 'node:fs';

import { RuntimeStartCommandSchema } from '@immersion/contracts/runtime';

import { getEngineInfo, start } from '../../../lib/llm-process.js';
import { getRuntimeOverview } from './get-runtime-overview.js';

export async function startRuntime(input: unknown) {
  const command = RuntimeStartCommandSchema.parse(input);

  if (!fs.existsSync(command.modelPath)) {
    throw new Error(`Model not found: ${command.modelPath}`);
  }

  const engine = getEngineInfo();

  if (!engine.found) {
    throw new Error('llama-server не найден.');
  }

  await start(command);

  return getRuntimeOverview();
}
