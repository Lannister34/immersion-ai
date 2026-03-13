import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import sanitize from 'sanitize-filename';
import writeFileAtomic from 'write-file-atomic';
import { dirs } from '../lib/paths.js';

export const router = Router();

// POST /api/scenarios/list
router.post('/list', (_req, res) => {
  try {
    const files = fs
      .readdirSync(dirs.scenarios)
      .filter((f) => f.endsWith('.json'));

    const result = files.map((f) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dirs.scenarios, f), 'utf-8'));
        return {
          name: data.name ?? path.parse(f).name,
          content: data.content ?? '',
          tags: data.tags ?? [],
          updatedAt: data.updatedAt ?? null,
        };
      } catch {
        return { name: path.parse(f).name, content: '', tags: [], updatedAt: null };
      }
    });

    res.json(result);
  } catch (err) {
    console.error('[scenarios/list]', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/scenarios/get
router.post('/get', (req, res) => {
  try {
    const name: string = req.body.name;
    if (!name) return res.sendStatus(400);

    const safeName = sanitize(name);
    const filePath = path.join(dirs.scenarios, `${safeName}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Scenario not found' });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(data);
  } catch (err) {
    console.error('[scenarios/get]', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/scenarios/create
router.post('/create', (req, res) => {
  try {
    const { name, content, tags, concept } = req.body;
    if (!name) return res.sendStatus(400);

    const safeName = sanitize(name);
    const filePath = path.join(dirs.scenarios, `${safeName}.json`);

    if (fs.existsSync(filePath)) {
      return res.status(409).json({ error: 'Scenario already exists' });
    }

    const now = new Date().toISOString();
    const data: Record<string, unknown> = {
      name,
      content: content ?? '',
      tags: tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    if (concept) data.concept = concept;

    writeFileAtomic.sync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    console.error('[scenarios/create]', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/scenarios/edit
router.post('/edit', (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) return res.sendStatus(400);

    const safeName = sanitize(name);
    const oldPath = path.join(dirs.scenarios, `${safeName}.json`);

    data.updatedAt = new Date().toISOString();

    // Handle rename: if data.name changed, write to new file and delete old
    const newName = data.name ? sanitize(data.name) : safeName;
    const newPath = path.join(dirs.scenarios, `${newName}.json`);

    writeFileAtomic.sync(newPath, JSON.stringify(data, null, 2), 'utf-8');

    if (newName !== safeName && fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }

    res.json({ ok: true, renamed: newName !== safeName ? data.name : undefined });
  } catch (err) {
    console.error('[scenarios/edit]', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/scenarios/delete
router.post('/delete', (req, res) => {
  try {
    const name: string = req.body.name;
    if (!name) return res.sendStatus(400);

    const safeName = sanitize(name);
    const filePath = path.join(dirs.scenarios, `${safeName}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[scenarios/delete]', err);
    res.status(500).json({ error: String(err) });
  }
});
