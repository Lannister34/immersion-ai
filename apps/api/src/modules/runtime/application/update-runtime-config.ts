import { RuntimeConfigCommandSchema } from '@immersion/contracts/runtime';

import { getRuntimeOverview } from './get-runtime-overview.js';
import { RuntimeConfigRepository } from './runtime-config-repository.js';

export async function updateRuntimeConfig(input: unknown, repository = new RuntimeConfigRepository()) {
  const command = RuntimeConfigCommandSchema.parse(input);

  await repository.write(command);

  return getRuntimeOverview();
}
