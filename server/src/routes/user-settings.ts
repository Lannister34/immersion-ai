import fs from 'node:fs';
import path from 'node:path';
import { type Request, type Response, Router } from 'express';
import { DATA_ROOT } from '../lib/paths.js';

export const router = Router();

const SETTINGS_FILE = path.join(DATA_ROOT, 'user-settings.json');

/**
 * Shallow-merge source into target.
 * - Plain objects (not arrays) are merged recursively.
 * - Arrays and primitives are replaced atomically.
 */
function shallowMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = result[key];
    if (
      srcVal !== null &&
      tgtVal !== null &&
      typeof srcVal === 'object' &&
      typeof tgtVal === 'object' &&
      !Array.isArray(srcVal) &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = shallowMerge(tgtVal as Record<string, unknown>, srcVal as Record<string, unknown>);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

function readSettings(): Record<string, unknown> {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) as Record<string, unknown>;
    }
  } catch {
    /* corrupted file — start fresh */
  }
  return {};
}

/** GET /api/user-settings — load saved UI settings */
router.get('/', (_req: Request, res: Response) => {
  try {
    const data = readSettings();
    res.json({ ok: true, data: Object.keys(data).length > 0 ? data : null });
  } catch (err) {
    console.error('Failed to read user settings:', err);
    res.json({ ok: true, data: null });
  }
});

/** POST /api/user-settings — merge incoming fields into saved settings */
router.post('/', (req: Request, res: Response) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ ok: false, error: 'Invalid data' });
      return;
    }
    const existing = readSettings();
    const merged = shallowMerge(existing, incoming as Record<string, unknown>);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save user settings:', err);
    res.status(500).json({ ok: false, error: 'Failed to save' });
  }
});
