import {
  type RuntimeOverviewResponse,
  RuntimeOverviewResponseSchema,
  type RuntimeStartCommand,
  RuntimeStartCommandSchema,
} from '@immersion/contracts/runtime';

import { apiPost } from '../../../shared/api/client';

export function startRuntime(command: RuntimeStartCommand) {
  return apiPost<RuntimeStartCommand, RuntimeOverviewResponse>(
    '/api/runtime/start',
    command,
    RuntimeStartCommandSchema,
    RuntimeOverviewResponseSchema,
  );
}
