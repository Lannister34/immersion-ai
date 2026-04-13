import {
  type RuntimeOverviewResponse,
  RuntimeOverviewResponseSchema,
  type RuntimeStopCommand,
  RuntimeStopCommandSchema,
} from '@immersion/contracts/runtime';

import { apiPost } from '../../../shared/api/client';

export function stopRuntime() {
  return apiPost<RuntimeStopCommand, RuntimeOverviewResponse>(
    '/api/runtime/stop',
    {},
    RuntimeStopCommandSchema,
    RuntimeOverviewResponseSchema,
  );
}
