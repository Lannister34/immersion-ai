import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import sanitize from 'sanitize-filename';
import sharp from 'sharp';
import writeFileAtomic from 'write-file-atomic';
import { dirs } from '../lib/paths.js';
import { read as readPng, write as writePng } from '../lib/png-card.js';
import type { CharacterListItem, CharacterV2, ChatFileInfo } from '../types.js';

export const router = Router();

// Default avatar: gray person silhouette placeholder (128x128 PNG)
const DEFAULT_AVATAR = Buffer.from(
  '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',
  'base64',
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function humanizedDateTime(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${mo}-${d} @${h}h ${mi}m ${s}s`;
}

/** Convert any image buffer to PNG format. Returns the buffer unchanged if already PNG. */
async function ensurePng(buf: Buffer): Promise<Buffer> {
  // Check PNG magic bytes: 137 80 78 71 13 10 26 10
  const isPng =
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a;
  if (isPng) return buf;
  return Buffer.from(await sharp(buf).png().toBuffer());
}

function getPngName(baseName: string): string {
  let name = baseName;
  let i = 1;
  while (fs.existsSync(path.join(dirs.characters, `${name}.png`))) {
    name = `${baseName}${i}`;
    i++;
  }
  return name;
}

function charaFormatData(data: Record<string, string | undefined>): CharacterV2 {
  const tags =
    typeof data.tags === 'string'
      ? data.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

  return {
    name: data.ch_name ?? '',
    description: data.description ?? '',
    personality: data.personality ?? '',
    scenario: '',
    first_mes: '',
    mes_example: data.mes_example ?? '',
    avatar: 'none',
    chat: `${data.ch_name ?? ''} - ${humanizedDateTime()}`,
    talkativeness: 0.5,
    fav: data.fav === 'true',
    tags,
    creatorcomment: data.creator_notes ?? '',
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: data.ch_name ?? '',
      description: data.description ?? '',
      personality: data.personality ?? '',
      scenario: '',
      first_mes: '',
      mes_example: data.mes_example ?? '',
      creator_notes: data.creator_notes ?? '',
      system_prompt: data.system_prompt ?? '',
      post_history_instructions: data.post_history_instructions ?? '',
      tags,
      creator: data.creator ?? '',
      character_version: data.character_version ?? '',
      alternate_greetings: [],
      extensions: {
        talkativeness: 0.5,
        fav: data.fav === 'true',
        world: data.world ?? '',
      },
    },
  };
}

function processCharacter(filename: string): CharacterListItem | null {
  try {
    const filePath = path.join(dirs.characters, filename);
    const rawJson = readPng(fs.readFileSync(filePath));
    const char = JSON.parse(rawJson);

    // Use V2 data fields if available
    const v2 = char.data ?? char;
    const charName = path.parse(filename).name;

    // Calculate chat stats
    let chatSize = 0;
    let dateLastChat = 0;
    const chatDir = path.join(dirs.chats, charName);
    if (fs.existsSync(chatDir)) {
      const chatFiles = fs.readdirSync(chatDir).filter((f) => f.endsWith('.jsonl'));
      for (const cf of chatFiles) {
        const stat = fs.statSync(path.join(chatDir, cf));
        chatSize += stat.size;
        if (stat.mtimeMs > dateLastChat) dateLastChat = stat.mtimeMs;
      }
    }

    return {
      name: v2.name ?? char.name ?? charName,
      avatar: filename,
      description: v2.description ?? char.description ?? '',
      personality: v2.personality ?? char.personality ?? '',
      mes_example: v2.mes_example ?? char.mes_example ?? '',
      tags: v2.tags ?? char.tags ?? [],
      world: v2.extensions?.world ?? '',
      system_prompt: v2.system_prompt ?? '',
      date_added: char.create_date ? Number(char.create_date) : 0,
      date_last_chat: dateLastChat,
      chat_size: chatSize,
      data: v2,
      fav: v2.extensions?.fav ?? char.fav ?? false,
      create_date: char.create_date,
    };
  } catch (err) {
    console.error(`Error processing character ${filename}:`, err);
    return null;
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /api/characters/all
router.post('/all', (_req, res) => {
  try {
    const files = fs.readdirSync(dirs.characters).filter((f) => f.endsWith('.png'));
    const characters: CharacterListItem[] = [];

    for (const file of files) {
      const char = processCharacter(file);
      if (char) characters.push(char);
    }

    res.json(characters);
  } catch (err) {
    console.error('[characters/all]', err);
    res.status(500).json({ error: 'Не удалось загрузить список персонажей' });
  }
});

// POST /api/characters/get
router.post('/get', (req, res) => {
  try {
    const avatarUrl: string = req.body.avatar_url ?? req.body.name;
    if (!avatarUrl) return res.sendStatus(400);

    const filePath = path.join(dirs.characters, avatarUrl);
    if (!fs.existsSync(filePath)) return res.sendStatus(404);

    const rawJson = readPng(fs.readFileSync(filePath));
    const char = JSON.parse(rawJson);
    char.avatar = avatarUrl;
    res.json(char);
  } catch (err) {
    console.error('[characters/get]', err);
    res.status(500).json({ error: 'Не удалось загрузить данные персонажа' });
  }
});

// POST /api/characters/get-full — returns same format as /all but for a single character
router.post('/get-full', (req, res) => {
  try {
    const avatarUrl: string = req.body.avatar_url;
    if (!avatarUrl) return res.status(400).json({ error: 'Не указан файл персонажа' });

    const char = processCharacter(avatarUrl);
    if (!char) return res.status(404).json({ error: 'Персонаж не найден' });

    res.json(char);
  } catch (err) {
    console.error('[characters/get-full]', err);
    res.status(500).json({ error: 'Не удалось загрузить данные персонажа' });
  }
});

// POST /api/characters/create (uses multer avatar upload)
router.post('/create', async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ error: 'Пустой запрос' });

    req.body.ch_name = sanitize(req.body.ch_name ?? '');
    if (!req.body.ch_name) return res.status(400).json({ error: 'Не указано имя персонажа' });

    const charData = JSON.stringify(charaFormatData(req.body));
    const internalName = getPngName(req.body.ch_name);
    const avatarName = `${internalName}.png`;

    // Create chat directory
    const chatDir = path.join(dirs.chats, internalName);
    if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });

    // Get image buffer (uploaded file or default placeholder)
    let imageBuffer: Buffer;
    if (req.file) {
      imageBuffer = fs.readFileSync(req.file.path);
      // Clean up uploaded temp file
      fs.unlinkSync(req.file.path);
      // Convert to PNG if needed (JPEG, WebP, etc.)
      try {
        imageBuffer = await ensurePng(imageBuffer);
      } catch (imgErr) {
        console.error('[characters/create] Image conversion failed:', imgErr);
        return res
          .status(400)
          .json({ error: 'Не удалось обработать изображение. Поддерживаются форматы: PNG, JPEG, WebP, GIF.' });
      }
    } else {
      imageBuffer = DEFAULT_AVATAR;
    }

    // Write character data into the PNG
    const outputImage = writePng(imageBuffer, charData);
    const outputPath = path.join(dirs.characters, avatarName);
    writeFileAtomic.sync(outputPath, outputImage);

    res.send(avatarName);
  } catch (err) {
    console.error('[characters/create]', err);
    res.status(500).json({ error: 'Не удалось создать персонажа. Попробуйте ещё раз.' });
  }
});

// POST /api/characters/edit (uses multer avatar upload)
router.post('/edit', async (req, res) => {
  try {
    if (!req.body?.avatar_url) return res.status(400).json({ error: 'Не указан файл персонажа' });

    const avatarUrl: string = req.body.avatar_url;
    const filePath = path.join(dirs.characters, avatarUrl);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Персонаж не найден' });

    // Read existing character data to preserve fields
    const existingRaw = readPng(fs.readFileSync(filePath));
    const existing = JSON.parse(existingRaw);

    // Format new data, preserving create_date and chat
    const updated = charaFormatData(req.body);
    updated.chat = existing.chat ?? updated.chat;
    if (existing.create_date) {
      (updated as unknown as Record<string, unknown>).create_date = existing.create_date;
    }

    const charJson = JSON.stringify(updated);

    // Use new avatar if uploaded, otherwise keep existing image
    let imageBuffer: Buffer;
    if (req.file) {
      imageBuffer = fs.readFileSync(req.file.path);
      fs.unlinkSync(req.file.path);
      // Convert to PNG if needed
      try {
        imageBuffer = await ensurePng(imageBuffer);
      } catch (imgErr) {
        console.error('[characters/edit] Image conversion failed:', imgErr);
        return res
          .status(400)
          .json({ error: 'Не удалось обработать изображение. Поддерживаются форматы: PNG, JPEG, WebP, GIF.' });
      }
    } else {
      imageBuffer = fs.readFileSync(filePath);
    }

    const outputImage = writePng(imageBuffer, charJson);
    writeFileAtomic.sync(filePath, outputImage);

    res.json({ ok: true });
  } catch (err) {
    console.error('[characters/edit]', err);
    res.status(500).json({ error: 'Не удалось сохранить персонажа. Попробуйте ещё раз.' });
  }
});

// POST /api/characters/delete
router.post('/delete', (req, res) => {
  try {
    const avatarUrl: string = req.body.avatar_url;
    if (!avatarUrl) return res.sendStatus(400);

    const filePath = path.join(dirs.characters, avatarUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Optionally delete chats
    if (req.body.delete_chats) {
      const charName = path.parse(avatarUrl).name;
      const chatDir = path.join(dirs.chats, charName);
      if (fs.existsSync(chatDir)) {
        fs.rmSync(chatDir, { recursive: true, force: true });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[characters/delete]', err);
    res.status(500).json({ error: 'Не удалось удалить персонажа' });
  }
});

// POST /api/characters/chats
router.post('/chats', (req, res) => {
  try {
    const avatarUrl: string = req.body.avatar_url;
    if (!avatarUrl) return res.sendStatus(400);

    const charName = path.parse(avatarUrl).name;
    const chatDir = path.join(dirs.chats, charName);

    if (!fs.existsSync(chatDir)) {
      return res.json({ error: true });
    }

    const chatFiles = fs.readdirSync(chatDir).filter((f) => f.endsWith('.jsonl'));

    const result: ChatFileInfo[] = [];
    for (const fileName of chatFiles) {
      try {
        const filePath = path.join(chatDir, fileName);
        const stat = fs.statSync(filePath);

        // Read only the tail of the file to get last message (much faster than reading entire file)
        const TAIL_BYTES = 4096;
        const fd = fs.openSync(filePath, 'r');
        const fileSize = stat.size;
        const readSize = Math.min(fileSize, TAIL_BYTES);
        const buf = Buffer.alloc(readSize);
        fs.readSync(fd, buf, 0, readSize, Math.max(0, fileSize - readSize));
        fs.closeSync(fd);

        const tail = buf.toString('utf-8');
        const tailLines = tail.split('\n').filter(Boolean);

        let lastMes = '';
        let lastTimestamp = '';

        // Parse from the end to find the last message
        for (let i = tailLines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(tailLines[i]);
            if ('chat_metadata' in parsed) continue;
            if (parsed.mes && !lastMes) lastMes = parsed.mes;
            if (parsed.send_date && !lastTimestamp) lastTimestamp = parsed.send_date;
            if (lastMes && lastTimestamp) break;
          } catch {
            // skip (might be a partial line at the start of buffer)
          }
        }

        // Estimate message count from file size (avg ~200 bytes per JSONL line)
        // For precise count we'd need to read the whole file
        const estimatedItems = Math.max(1, Math.round(fileSize / 200));

        result.push({
          file_name: path.parse(fileName).name,
          chat_items: estimatedItems,
          mes: lastMes.slice(0, 120),
          last_mes: lastTimestamp || String(stat.mtimeMs),
        });
      } catch {
        // skip individual file errors
      }
    }

    res.json(result);
  } catch (err) {
    console.error('[characters/chats]', err);
    res.status(500).json({ error: 'Не удалось загрузить список чатов' });
  }
});

// ── One-time migration: clear scenario/first_mes from character cards ────────

const MIGRATION_FLAG = path.join(dirs.characters, '.migrated_no_scenario');

if (!fs.existsSync(MIGRATION_FLAG)) {
  try {
    const pngs = fs.readdirSync(dirs.characters).filter((f) => f.endsWith('.png'));
    let migrated = 0;
    for (const png of pngs) {
      try {
        const filePath = path.join(dirs.characters, png);
        const buf = fs.readFileSync(filePath);
        const rawJson = readPng(buf);
        const char = JSON.parse(rawJson);

        let changed = false;
        // Clear top-level fields
        if (char.scenario) {
          char.scenario = '';
          changed = true;
        }
        if (char.first_mes) {
          char.first_mes = '';
          changed = true;
        }
        // Clear V2 data fields
        if (char.data?.scenario) {
          char.data.scenario = '';
          changed = true;
        }
        if (char.data?.first_mes) {
          char.data.first_mes = '';
          changed = true;
        }

        if (changed) {
          const output = writePng(buf, JSON.stringify(char));
          writeFileAtomic.sync(filePath, output);
          migrated++;
        }
      } catch {
        // skip individual file errors
      }
    }
    fs.writeFileSync(MIGRATION_FLAG, `Migrated ${migrated}/${pngs.length} cards at ${new Date().toISOString()}\n`);
    if (migrated > 0) {
      console.log(`[characters] Migration: cleared scenario/first_mes from ${migrated} character card(s)`);
    }
  } catch (err) {
    console.warn('[characters] Migration failed:', err);
  }
}
