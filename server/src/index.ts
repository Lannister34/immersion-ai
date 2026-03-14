import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieSession from 'cookie-session';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { setupGracefulShutdown } from './lib/llm-process.js';
import { CLIENT_DIST, DATA_ROOT, dirs, ensureDataDirs } from './lib/paths.js';
import { router as aiGenerationRouter } from './routes/ai-generation.js';
import { router as charactersRouter } from './routes/characters.js';
import { router as chatsRouter } from './routes/chats.js';
import { router as koboldRouter } from './routes/kobold.js';
import { router as llmServerRouter } from './routes/llm-server.js';
import { router as providersRouter } from './routes/providers.js';
import { router as scenariosRouter } from './routes/scenarios.js';
import { router as settingsRouter } from './routes/settings.js';
import { router as userSettingsRouter } from './routes/user-settings.js';
import { router as worldinfoRouter } from './routes/worldinfo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 4777;

// ── Initialize ───────────────────────────────────────────────────────────────

ensureDataDirs();

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session for CSRF tokens
app.use(
  cookieSession({
    name: 'session',
    keys: ['immersion-ai-secret-key'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  }),
);

// ── CSRF Protection ──────────────────────────────────────────────────────────

// Simple CSRF implementation: generate token in session, validate on POST
function generateCsrfToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

app.get('/csrf-token', (req, res) => {
  const token = generateCsrfToken();
  if (req.session) {
    req.session.csrfToken = token;
  }
  res.json({ token });
});

// Validate CSRF on all POST/PUT/DELETE requests
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const sessionToken = req.session?.csrfToken;
  const headerToken = req.headers['x-csrf-token'] as string | undefined;

  if (!sessionToken || !headerToken || sessionToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }
  next();
});

// ── File Upload (Multer) ─────────────────────────────────────────────────────

const uploadsDir = path.join(DATA_ROOT, '_uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

// ── Static File Serving ──────────────────────────────────────────────────────

// Serve character images
app.use(
  '/characters',
  express.static(dirs.characters, {
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

// ── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/settings', settingsRouter);
app.use('/api/characters', upload.single('avatar'), charactersRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/worldinfo', worldinfoRouter);
app.use('/api/scenarios', scenariosRouter);
app.use('/api/backends/kobold', koboldRouter);
app.use('/api/providers', providersRouter);
app.use('/api/ai-generation', aiGenerationRouter);
app.use('/api/user-settings', userSettingsRouter);
app.use('/api/llm-server', llmServerRouter);

// ── Production: Serve Client Build ───────────────────────────────────────────

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

// ── Start Server ─────────────────────────────────────────────────────────────

// Kill llama-server subprocess on exit
setupGracefulShutdown();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🚀 Immersion AI server running on http://0.0.0.0:${PORT}`);
  console.log(`  📁 Data directory: ${DATA_ROOT}`);
  console.log(`  📦 Characters: ${dirs.characters}`);
  console.log(`  💬 Chats: ${dirs.chats}`);
  console.log(`  🌍 Worlds: ${dirs.worlds}`);
  console.log(`  🎭 Scenarios: ${dirs.scenarios}\n`);
});
