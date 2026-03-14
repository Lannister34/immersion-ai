import { type ChildProcess, execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

/** File where we persist the PID so we can reconnect after tsx restart */
const PID_FILE = path.join(PROJECT_ROOT, 'data', '.llm-server.json');

// ── Types ────────────────────────────────────────────────────────────────────

export interface LlmStartConfig {
  modelPath: string;
  port: number;
  gpuLayers: number;
  contextSize: number;
  flashAttention: boolean;
  threads: number;
}

export interface EngineInfo {
  found: boolean;
  executablePath: string | null;
  defaultModelsDir: string;
}

export interface LlmServerState {
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'error';
  model: string | null;
  modelPath: string | null;
  error: string | null;
  port: number;
  pid: number | null;
}

interface PidFileData {
  pid: number;
  port: number;
  model: string;
  modelPath: string;
}

// ── Engine auto-detection ────────────────────────────────────────────────────

const SEARCH_PATHS = [
  path.join(PROJECT_ROOT, 'bin', 'llama-server.exe'),
  path.join(PROJECT_ROOT, 'bin', 'llama-server'),
  path.join(PROJECT_ROOT, 'llama-server.exe'),
  path.join(PROJECT_ROOT, 'llama-server'),
];

function findExecutable(): string | null {
  for (const p of SEARCH_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function getEngineInfo(): EngineInfo {
  const executablePath = findExecutable();
  return {
    found: !!executablePath,
    executablePath,
    defaultModelsDir: path.join(PROJECT_ROOT, 'models'),
  };
}

// ── Ring buffer for process output ───────────────────────────────────────────

const MAX_LOG_LINES = 100;
const logBuffer: string[] = [];

function pushLog(line: string) {
  logBuffer.push(line);
  if (logBuffer.length > MAX_LOG_LINES) {
    logBuffer.shift();
  }
}

// ── PID file management ─────────────────────────────────────────────────────

function savePidFile(data: PidFileData): void {
  try {
    fs.writeFileSync(PID_FILE, JSON.stringify(data), 'utf-8');
  } catch (err) {
    console.error('[llm-process] failed to save PID file:', (err as Error).message);
  }
}

function readPidFile(): PidFileData | null {
  try {
    if (!fs.existsSync(PID_FILE)) return null;
    return JSON.parse(fs.readFileSync(PID_FILE, 'utf-8')) as PidFileData;
  } catch {
    return null;
  }
}

function removePidFile(): void {
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch {
    /* ignore */
  }
}

/** Check if a process with given PID is alive (Windows + Unix) */
function isProcessAlive(pid: number): boolean {
  try {
    // process.kill(pid, 0) checks existence without sending a signal
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ── Singleton state ─────────────────────────────────────────────────────────

/** We hold a ChildProcess handle only for processes WE spawned this session.
 *  For reconnected processes (from PID file), childProcess is null — we only
 *  know the PID and check health. */
let childProcess: ChildProcess | null = null;
let healthPollTimer: ReturnType<typeof setInterval> | null = null;
let startTimeout: ReturnType<typeof setTimeout> | null = null;

const state: LlmServerState = {
  status: 'idle',
  model: null,
  modelPath: null,
  error: null,
  port: 5001,
  pid: null,
};

// ── Public API ──────────────────────────────────────────────────────────────

export function getState(): LlmServerState {
  return { ...state };
}

export function getLogs(): string[] {
  return [...logBuffer];
}

export async function start(config: LlmStartConfig): Promise<void> {
  // If already running, stop first
  if (state.status === 'running' || state.status === 'starting') {
    await stop();
  }

  // Auto-detect executable
  const executablePath = findExecutable();
  if (!executablePath) {
    state.status = 'error';
    state.error = 'llama-server не найден. Поместите llama-server.exe в папку bin/';
    return;
  }

  // Clear logs
  logBuffer.length = 0;

  state.status = 'starting';
  state.model = path.basename(config.modelPath);
  state.modelPath = config.modelPath;
  state.error = null;
  state.port = config.port;

  // Build CLI arguments
  const args: string[] = [
    '-m',
    config.modelPath,
    '-ngl',
    String(config.gpuLayers),
    '-c',
    String(config.contextSize),
    '--host',
    '127.0.0.1',
    '--port',
    String(config.port),
  ];

  if (config.flashAttention) {
    args.push('-fa', 'on');
  }

  if (config.threads > 0) {
    args.push('--threads', String(config.threads));
  }

  console.log('[llm-process] spawning: %s %s', executablePath, args.join(' '));

  try {
    // Spawn DETACHED so llama-server survives tsx restarts.
    // We pipe stdout/stderr so we can capture logs while running,
    // but call unref() so Node doesn't wait for the child on exit.
    childProcess = spawn(executablePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      windowsHide: true,
    });

    state.pid = childProcess.pid ?? null;

    // Save PID file so we can reconnect after tsx restart
    if (state.pid) {
      savePidFile({ pid: state.pid, port: config.port, model: state.model!, modelPath: config.modelPath });
    }

    // Pipe stdout/stderr to ring buffer
    childProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        pushLog(line);
      }
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        pushLog(`[stderr] ${line}`);
      }
    });

    childProcess.on('error', (err) => {
      console.error('[llm-process] spawn error:', err.message);
      state.status = 'error';
      state.error = err.message;
      state.pid = null;
      removePidFile();
      cleanupTimers();
    });

    childProcess.on('exit', (code, signal) => {
      console.log('[llm-process] exited code=%s signal=%s', code, signal);
      if (state.status !== 'stopping') {
        // Unexpected exit
        state.status = 'error';
        state.error = `Process exited with code ${code}`;
      } else {
        state.status = 'idle';
        state.error = null;
      }
      state.pid = null;
      childProcess = null;
      removePidFile();
      cleanupTimers();
    });

    // Allow the parent process to exit without waiting for the child
    childProcess.unref();

    // Start health polling
    startHealthPoll(config.port);

    // Set 5-minute timeout
    startTimeout = setTimeout(
      () => {
        if (state.status === 'starting') {
          console.error('[llm-process] start timeout (5 min), killing');
          state.error = 'Startup timeout (5 minutes)';
          killProcess();
          state.status = 'error';
        }
      },
      5 * 60 * 1000,
    );
  } catch (err) {
    state.status = 'error';
    state.error = (err as Error).message;
    console.error('[llm-process] failed to spawn:', err);
  }
}

export async function stop(): Promise<void> {
  cleanupTimers();

  const pid = state.pid;
  state.status = 'stopping';

  if (childProcess) {
    // We have a handle — use it
    console.log('[llm-process] stopping pid=%d (handle)', childProcess.pid);
    await killProcess();
  } else if (pid) {
    // Reconnected process — kill by PID
    console.log('[llm-process] stopping pid=%d (by PID)', pid);
    await killByPid(pid);
  }

  state.status = 'idle';
  state.model = null;
  state.modelPath = null;
  state.pid = null;
  removePidFile();
}

// ── Health polling ──────────────────────────────────────────────────────────

function startHealthPoll(port: number) {
  healthPollTimer = setInterval(async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        if (data.status === 'ok') {
          console.log('[llm-process] health OK — server is running');
          state.status = 'running';
          state.error = null;
          cleanupTimers();
        }
      }
    } catch {
      // Server not ready yet, keep polling
    }
  }, 500);
}

// ── Reconnect on startup ────────────────────────────────────────────────────

/** Called once on module load. Checks PID file and reconnects if the process
 *  is still alive and healthy. */
async function tryReconnect(): Promise<void> {
  const saved = readPidFile();
  if (!saved) return;

  console.log('[llm-process] found PID file: pid=%d port=%d model=%s', saved.pid, saved.port, saved.model);

  // Check if the process is still alive
  if (!isProcessAlive(saved.pid)) {
    console.log('[llm-process] process %d is not alive, cleaning up', saved.pid);
    removePidFile();
    return;
  }

  // Process is alive — check if it responds to health
  try {
    const res = await fetch(`http://127.0.0.1:${saved.port}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      if (data.status === 'ok') {
        console.log('[llm-process] reconnected to existing llama-server (pid=%d)', saved.pid);
        state.status = 'running';
        state.model = saved.model;
        state.modelPath = saved.modelPath ?? null;
        state.port = saved.port;
        state.pid = saved.pid;
        state.error = null;
        return;
      }
    }
  } catch {
    // Health check failed
  }

  // Process alive but not healthy — might still be loading
  console.log('[llm-process] process %d alive but not healthy yet, polling...', saved.pid);
  state.status = 'starting';
  state.model = saved.model;
  state.modelPath = saved.modelPath ?? null;
  state.port = saved.port;
  state.pid = saved.pid;
  state.error = null;
  startHealthPoll(saved.port);

  // Timeout: if still not healthy after 5 min, give up
  startTimeout = setTimeout(
    () => {
      if (state.status === 'starting') {
        console.error('[llm-process] reconnect timeout (5 min), giving up');
        state.status = 'error';
        state.error = 'Reconnect timeout — server not responding';
        cleanupTimers();
      }
    },
    5 * 60 * 1000,
  );
}

// Run reconnect on module load
tryReconnect().catch((err) => {
  console.error('[llm-process] reconnect error:', err);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanupTimers() {
  if (healthPollTimer) {
    clearInterval(healthPollTimer);
    healthPollTimer = null;
  }
  if (startTimeout) {
    clearTimeout(startTimeout);
    startTimeout = null;
  }
}

function killProcess(): Promise<void> {
  return new Promise((resolve) => {
    if (!childProcess) {
      resolve();
      return;
    }

    const proc = childProcess;

    // Listen for exit
    const onExit = () => {
      clearTimeout(forceKillTimer);
      resolve();
    };
    proc.once('exit', onExit);

    // Try graceful kill
    proc.kill('SIGTERM');

    // Force kill after 5 seconds
    const forceKillTimer = setTimeout(() => {
      if (proc.exitCode === null) {
        console.log('[llm-process] force-killing after 5s');
        proc.kill('SIGKILL');
      }
    }, 5000);
  });
}

/** Kill a process by PID when we don't have a ChildProcess handle (reconnected) */
async function killByPid(pid: number): Promise<void> {
  if (!isProcessAlive(pid)) return;

  try {
    // On Windows, use taskkill for reliable termination
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F /T`, { windowsHide: true, stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
      // Wait a bit, then force-kill if still alive
      await new Promise((r) => setTimeout(r, 3000));
      if (isProcessAlive(pid)) {
        process.kill(pid, 'SIGKILL');
      }
    }
    console.log('[llm-process] killed pid=%d', pid);
  } catch (err) {
    console.error('[llm-process] failed to kill pid=%d:', pid, (err as Error).message);
  }
}

// ── Graceful shutdown ───────────────────────────────────────────────────────

/** llama-server is detached and survives parent exit on its own.
 *  On ANY signal (SIGTERM from tsx, SIGINT from Ctrl+C or PM2 watch-restart)
 *  we keep the child alive. The PID file allows the next startup to reconnect.
 *  The user can stop llama-server explicitly through the UI. */
export function setupGracefulShutdown() {
  process.on('SIGTERM', () => {
    console.log('[llm-process] SIGTERM — keeping llama-server alive');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[llm-process] SIGINT — keeping llama-server alive');
    process.exit(0);
  });
}
