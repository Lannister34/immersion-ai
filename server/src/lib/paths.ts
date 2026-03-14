import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Project root (two levels up from server/src/lib/) */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

/** Data directory at project root */
export const DATA_ROOT = path.join(PROJECT_ROOT, 'data');

export const dirs = {
  root: DATA_ROOT,
  characters: path.join(DATA_ROOT, 'characters'),
  chats: path.join(DATA_ROOT, 'chats'),
  worlds: path.join(DATA_ROOT, 'worlds'),
  scenarios: path.join(DATA_ROOT, 'scenarios'),
} as const;

/** Client dist directory for production static serving */
export const CLIENT_DIST = path.join(PROJECT_ROOT, 'client', 'dist');

/** Ensure all required data directories exist */
export function ensureDataDirs(): void {
  for (const dir of Object.values(dirs)) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Create default settings.json if missing
  const settingsPath = path.join(DATA_ROOT, 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    const defaults = {
      textgenerationwebui: {
        server_urls: {
          koboldcpp: 'http://127.0.0.1:5001',
        },
      },
    };
    fs.writeFileSync(settingsPath, JSON.stringify(defaults, null, 2), 'utf-8');
  }
}
