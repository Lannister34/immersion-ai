import { stop } from '../../../lib/llm-process.js';
import { getRuntimeOverview } from './get-runtime-overview.js';

export async function stopRuntime() {
  await stop();

  return getRuntimeOverview();
}
