import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import writeFileAtomic from 'write-file-atomic';
import { dirs } from '../lib/paths.js';

function safeFilename(name: string): boolean {
  return !name.includes('..') && !name.includes('/') && !name.includes('\\');
}

export const router = Router();

// POST /api/chats/get
router.post('/get', async (req, res) => {
  try {
    const { avatar_url, file_name } = req.body;
    if (!avatar_url || !file_name) return res.sendStatus(400);

    const charName = path.parse(avatar_url).name;
    const chatFileName = file_name.endsWith('.jsonl')
      ? file_name
      : `${file_name}.jsonl`;
    const filePath = path.join(dirs.chats, charName, chatFileName);

    try {
      await fs.promises.access(filePath);
    } catch {
      return res.json([]);
    }

    const content = (await fs.promises.readFile(filePath, 'utf-8')).trim();
    if (!content) return res.json([]);

    const lines = content.split('\n').filter(Boolean);
    const messages: unknown[] = [];

    for (const line of lines) {
      try {
        messages.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    }

    res.json(messages);
  } catch (err) {
    console.error('[chats/get]', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/chats/save
router.post('/save', (req, res) => {
  try {
    const { avatar_url, file_name, chat } = req.body;
    if (!avatar_url || !file_name || !Array.isArray(chat)) {
      return res.sendStatus(400);
    }

    const charName = path.parse(avatar_url).name;
    const chatDir = path.join(dirs.chats, charName);

    // Create chat directory if missing
    if (!fs.existsSync(chatDir)) {
      fs.mkdirSync(chatDir, { recursive: true });
    }

    const chatFileName = file_name.endsWith('.jsonl')
      ? file_name
      : `${file_name}.jsonl`;
    const filePath = path.join(chatDir, chatFileName);

    // Serialize each message as a JSON line
    const content = chat.map((msg) => JSON.stringify(msg)).join('\n');
    writeFileAtomic.sync(filePath, content, 'utf-8');

    res.json({ ok: true });
  } catch (err) {
    console.error('[chats/save]', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/chats/all — returns all chat sessions across all characters in one call
router.post('/all', async (_req, res) => {
  try {
    const chatsRoot = dirs.chats;
    let charDirs: string[];
    try {
      charDirs = await fs.promises.readdir(chatsRoot);
    } catch {
      return res.json([]);
    }

    // Also read character dir to map charName → avatar filename
    let charFiles: string[];
    try {
      charFiles = (await fs.promises.readdir(dirs.characters)).filter(f => f.endsWith('.png'));
    } catch {
      charFiles = [];
    }
    const avatarMap = new Map<string, string>();
    for (const f of charFiles) {
      avatarMap.set(path.parse(f).name, f);
    }

    const TAIL_BYTES = 8192;
    const results: Array<{
      characterAvatar: string;
      characterName: string;
      chatFile: string;
      lastMessage: string;
      lastDate: string;
      messageCount: number;
      fileSize: number;
    }> = [];

    await Promise.all(charDirs.map(async (charName) => {
      const charDir = path.join(chatsRoot, charName);
      let dirStat;
      try {
        dirStat = await fs.promises.stat(charDir);
      } catch { return; }
      if (!dirStat.isDirectory()) return;

      const avatar = avatarMap.get(charName) ?? `${charName}.png`;
      let chatFiles: string[];
      try {
        chatFiles = (await fs.promises.readdir(charDir)).filter(f => f.endsWith('.jsonl'));
      } catch { return; }

      await Promise.all(chatFiles.map(async (fileName) => {
        try {
          const filePath = path.join(charDir, fileName);
          const fileBuf = await fs.promises.readFile(filePath);
          const fileSize = fileBuf.length;
          if (fileSize === 0) return;

          // Count actual newlines for real message count
          let lineCount = 0;
          for (let i = 0; i < fileSize; i++) {
            if (fileBuf[i] === 0x0A) lineCount++;
          }
          // If file doesn't end with \n, the last line still counts
          if (fileBuf[fileSize - 1] !== 0x0A) lineCount++;
          // First line is chat_metadata → messages = lines - 1
          const messageCount = Math.max(0, lineCount - 1);

          // Tail-read for last message from already-loaded buffer
          const tailStart = Math.max(0, fileSize - TAIL_BYTES);
          const tail = fileBuf.subarray(tailStart).toString('utf-8');
          const tailLines = tail.split('\n').filter(Boolean);

          let lastMes = '';
          let lastTimestamp = '';
          for (let i = tailLines.length - 1; i >= 0; i--) {
            try {
              const parsed = JSON.parse(tailLines[i]);
              if ('chat_metadata' in parsed) continue;
              if (parsed.mes && !lastMes) lastMes = parsed.mes;
              if (parsed.send_date && !lastTimestamp) lastTimestamp = parsed.send_date;
              if (lastMes && lastTimestamp) break;
            } catch { /* partial line at start of tail */ }
          }

          results.push({
            characterAvatar: avatar,
            characterName: charName,
            chatFile: path.parse(fileName).name,
            lastMessage: lastMes.slice(0, 120),
            lastDate: lastTimestamp || String(Date.now()),
            messageCount,
            fileSize,
          });
        } catch { /* skip */ }
      }));
    }));

    res.json(results);
  } catch (err) {
    console.error('[chats/all]', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/chats/delete
router.post('/delete', (req, res) => {
  try {
    const { avatar_url, file_name } = req.body;
    if (!avatar_url || !file_name) return res.sendStatus(400);

    const charName = path.parse(avatar_url).name;
    const chatFileName = file_name.endsWith('.jsonl')
      ? file_name
      : `${file_name}.jsonl`;

    if (!safeFilename(chatFileName)) {
      return res.status(400).json({ error: 'Invalid file name' });
    }

    const filePath = path.join(dirs.chats, charName, chatFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) {
    console.error('[chats/delete]', err);
    res.status(500).json({ error: String(err) });
  }
});
