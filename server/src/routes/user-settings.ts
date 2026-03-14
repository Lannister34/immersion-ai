import fs from 'node:fs';
import path from 'node:path';
import { type Request, type Response, Router } from 'express';
import { DATA_ROOT } from '../lib/paths.js';

export const router = Router();

const SETTINGS_FILE = path.join(DATA_ROOT, 'user-settings.json');

/** GET /api/user-settings — load saved UI settings */
router.get('/', (_req: Request, res: Response) => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      res.json({ ok: true, data });
    } else {
      res.json({ ok: true, data: null });
    }
  } catch (err) {
    console.error('Failed to read user settings:', err);
    res.json({ ok: true, data: null });
  }
});

/** POST /api/user-settings — save UI settings */
router.post('/', (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      res.status(400).json({ ok: false, error: 'Invalid data' });
      return;
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save user settings:', err);
    res.status(500).json({ ok: false, error: 'Failed to save' });
  }
});
