import {
  type RuntimeInstallCommand,
  RuntimeInstallCommandSchema,
  type RuntimeOverviewResponse,
  RuntimeOverviewResponseSchema,
} from '@immersion/contracts/runtime';

import { apiPost } from '../../../shared/api/client';

export function installRuntime(command: RuntimeInstallCommand) {
  return apiPost<RuntimeInstallCommand, RuntimeOverviewResponse>(
    '/api/runtime/install',
    command,
    RuntimeInstallCommandSchema,
    RuntimeOverviewResponseSchema,
  );
}
