import fs from 'node:fs';
import path from 'node:path';

import { resolveDataRoot } from '../../lib/data-root.js';

function readJsonObject(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}`);
  }

  return parsed as Record<string, unknown>;
}

export function readLegacyUserSettingsSource() {
  return readJsonObject(path.join(resolveDataRoot(), 'user-settings.json'));
}

export function readLegacyAppSettingsSource() {
  return readJsonObject(path.join(resolveDataRoot(), 'settings.json'));
}
