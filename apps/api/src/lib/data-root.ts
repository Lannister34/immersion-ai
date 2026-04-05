import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

export function resolveDataRoot() {
  if (process.env.IMMERSION_DATA_ROOT) {
    return path.resolve(process.env.IMMERSION_DATA_ROOT);
  }

  return path.join(PROJECT_ROOT, 'data');
}

export function hasDataRoot() {
  return fs.existsSync(resolveDataRoot());
}
