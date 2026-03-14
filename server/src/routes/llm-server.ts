import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import type { LlmStartConfig } from '../lib/llm-process.js';
import { getEngineInfo, getLogs, getState, start, stop } from '../lib/llm-process.js';

export const router = Router();

// GET /api/llm-server/engine — check if llama-server binary is available
router.get('/engine', (_req, res) => {
  res.json(getEngineInfo());
});

// POST /api/llm-server/start — start llama-server subprocess
router.post('/start', async (req, res) => {
  try {
    const config = req.body as LlmStartConfig;

    if (!config.modelPath) {
      return res.status(400).json({ ok: false, error: 'modelPath is required' });
    }

    // Validate model file exists
    if (!fs.existsSync(config.modelPath)) {
      return res.status(400).json({ ok: false, error: `Model not found: ${config.modelPath}` });
    }

    await start(config);
    res.json({ ok: true });
  } catch (err) {
    console.error('[llm-server/start]', err);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// POST /api/llm-server/stop — stop llama-server subprocess
router.post('/stop', async (_req, res) => {
  try {
    await stop();
    res.json({ ok: true });
  } catch (err) {
    console.error('[llm-server/stop]', err);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// GET /api/llm-server/status — get subprocess state (no CSRF needed for GET)
router.get('/status', (_req, res) => {
  res.json(getState());
});

// Scan a single directory for .gguf files (top-level + 1 level deep)
function scanDirectory(modelsDir: string): Array<{ name: string; path: string; size: number }> {
  if (!fs.existsSync(modelsDir)) return [];

  const models: Array<{ name: string; path: string; size: number }> = [];
  const entries = fs.readdirSync(modelsDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(modelsDir, entry.name);

    if (entry.isFile() && entry.name.endsWith('.gguf')) {
      const stat = fs.statSync(fullPath);
      models.push({ name: entry.name, path: fullPath, size: stat.size });
    }

    // Scan one level deep (subdirectories)
    if (entry.isDirectory()) {
      try {
        const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
        for (const subEntry of subEntries) {
          if (subEntry.isFile() && subEntry.name.endsWith('.gguf')) {
            const subPath = path.join(fullPath, subEntry.name);
            const stat = fs.statSync(subPath);
            models.push({
              name: `${entry.name}/${subEntry.name}`,
              path: subPath,
              size: stat.size,
            });
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }
  }

  return models;
}

// POST /api/llm-server/models — list .gguf files across multiple directories
router.post('/models', async (req, res) => {
  try {
    // Support both new (modelsDirs: string[]) and legacy (modelsDir: string)
    const dirs: string[] = Array.isArray(req.body?.modelsDirs)
      ? req.body.modelsDirs
      : typeof req.body?.modelsDir === 'string' && req.body.modelsDir
        ? [req.body.modelsDir]
        : [];

    if (dirs.length === 0) {
      return res.status(400).json({ models: [] });
    }

    const allModels: Array<{ name: string; path: string; size: number }> = [];
    const seenPaths = new Set<string>();

    for (const dir of dirs) {
      for (const model of scanDirectory(dir)) {
        if (!seenPaths.has(model.path)) {
          seenPaths.add(model.path);
          allModels.push(model);
        }
      }
    }

    allModels.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ models: allModels });
  } catch (err) {
    console.error('[llm-server/models]', err);
    res.json({ models: [] });
  }
});

// GET /api/llm-server/logs — get subprocess output (no CSRF needed for GET)
router.get('/logs', (_req, res) => {
  res.json({ lines: getLogs() });
});

// POST /api/llm-server/browse-folder — open native folder picker dialog
router.post('/browse-folder', async (req, res) => {
  try {
    const initialDir = (req.body?.initialDir as string) || '';
    const { execSync } = await import('node:child_process');

    // Use PowerShell to open Windows folder picker
    const psScript = initialDir
      ? `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.SelectedPath = '${initialDir.replace(/'/g, "''")}'; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath } else { '' }`
      : `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath } else { '' }`;

    const result = execSync(`powershell -NoProfile -Command "${psScript}"`, {
      encoding: 'utf-8',
      timeout: 60_000,
      windowsHide: true,
    }).trim();

    res.json({ path: result || null });
  } catch (err) {
    console.error('[llm-server/browse-folder]', err);
    res.json({ path: null });
  }
});

// POST /api/llm-server/browse-file — open native file picker dialog
router.post('/browse-file', async (req, res) => {
  try {
    const filter = (req.body?.filter as string) || 'All files|*.*';
    const initialDir = (req.body?.initialDir as string) || '';
    const { execSync } = await import('node:child_process');

    // Use PowerShell to open Windows file picker
    const psScript = [
      `Add-Type -AssemblyName System.Windows.Forms`,
      `$f = New-Object System.Windows.Forms.OpenFileDialog`,
      `$f.Filter = '${filter.replace(/'/g, "''")}'`,
      initialDir ? `$f.InitialDirectory = '${initialDir.replace(/'/g, "''")}'` : '',
      `if ($f.ShowDialog() -eq 'OK') { $f.FileName } else { '' }`,
    ]
      .filter(Boolean)
      .join('; ');

    const result = execSync(`powershell -NoProfile -Command "${psScript}"`, {
      encoding: 'utf-8',
      timeout: 60_000,
      windowsHide: true,
    }).trim();

    res.json({ path: result || null });
  } catch (err) {
    console.error('[llm-server/browse-file]', err);
    res.json({ path: null });
  }
});
