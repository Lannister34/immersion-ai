import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import sanitize from 'sanitize-filename';
import writeFileAtomic from 'write-file-atomic';
import { dirs } from '../lib/paths.js';

export const router = Router();

// POST /api/worldinfo/list
router.post('/list', (_req, res) => {
  try {
    const files = fs
      .readdirSync(dirs.worlds)
      .filter((f) => f.endsWith('.json'));

    const result = files.map((f) => ({
      file_id: path.parse(f).name,
      name: path.parse(f).name,
    }));

    res.json(result);
  } catch (err) {
    console.error('[worldinfo/list]', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/worldinfo/get
router.post('/get', (req, res) => {
  try {
    const name: string = req.body.name;
    if (!name) return res.sendStatus(400);

    const safeName = sanitize(name);
    const filePath = path.join(dirs.worlds, `${safeName}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'World info not found' });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(data);
  } catch (err) {
    console.error('[worldinfo/get]', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/worldinfo/edit
router.post('/edit', (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) return res.sendStatus(400);

    const safeName = sanitize(name);
    const filePath = path.join(dirs.worlds, `${safeName}.json`);

    writeFileAtomic.sync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    console.error('[worldinfo/edit]', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/worldinfo/delete
router.post('/delete', (req, res) => {
  try {
    const name: string = req.body.name;
    if (!name) return res.sendStatus(400);

    const safeName = sanitize(name);
    const filePath = path.join(dirs.worlds, `${safeName}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[worldinfo/delete]', err);
    res.status(500).json({ error: String(err) });
  }
});
