import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { DATA_ROOT } from '../lib/paths.js';

export const router = Router();

router.post('/get', (_req, res) => {
  try {
    const settingsPath = path.join(DATA_ROOT, 'settings.json');

    let settingsRaw = '{}';
    let settingsObj: Record<string, unknown> = {};

    if (fs.existsSync(settingsPath)) {
      settingsRaw = fs.readFileSync(settingsPath, 'utf-8');
      try {
        settingsObj = JSON.parse(settingsRaw);
      } catch {
        settingsObj = {};
      }
    }

    // The frontend expects settings as a raw JSON string plus top-level fields
    // Note: connection URL is now resolved from user-settings.json connectionPresets,
    // not from textgenerationwebui.server_urls (kept for backward compatibility only)
    res.json({
      settings: settingsRaw,
      textgenerationwebui: settingsObj.textgenerationwebui ?? {},
      textgenerationwebui_preset_names: [],
      textgenerationwebui_presets: [],
    });
  } catch (err) {
    console.error('[settings/get]', err);
    res.status(500).json({ error: String(err) });
  }
});
