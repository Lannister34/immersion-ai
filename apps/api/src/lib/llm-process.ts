import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RuntimeEngineInfo, RuntimeStatusSnapshot } from '@immersion/contracts/runtime';

import { resolveDataRoot } from './data-root.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const PID_FILE_NAME = '.llm-server.json';

const SEARCH_PATHS = [
  path.join(PROJECT_ROOT, 'bin', 'llama-server.exe'),
  path.join(PROJECT_ROOT, 'bin', 'llama-server'),
  path.join(PROJECT_ROOT, 'llama-server.exe'),
  path.join(PROJECT_ROOT, 'llama-server'),
];

interface PidFileData {
  pid: number;
  port: number;
  model: string;
  modelPath: string;
}

function findExecutable() {
  for (const candidate of SEARCH_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function readPidFile(): PidFileData | null {
  const pidFilePath = path.join(resolveDataRoot(), PID_FILE_NAME);

  try {
    if (!fs.existsSync(pidFilePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(pidFilePath, 'utf8')) as PidFileData;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getEngineInfo(): RuntimeEngineInfo {
  const executablePath = findExecutable();

  return {
    found: executablePath !== null,
    executablePath,
    defaultModelsDir: path.join(PROJECT_ROOT, 'models'),
  };
}

export function getState(): RuntimeStatusSnapshot {
  const pidFile = readPidFile();

  if (!pidFile) {
    return {
      status: 'idle',
      model: null,
      modelPath: null,
      error: null,
      port: 5001,
      pid: null,
    };
  }

  if (isProcessAlive(pidFile.pid)) {
    return {
      status: 'running',
      model: pidFile.model,
      modelPath: pidFile.modelPath,
      error: null,
      port: pidFile.port,
      pid: pidFile.pid,
    };
  }

  return {
    status: 'idle',
    model: null,
    modelPath: null,
    error: null,
    port: pidFile.port,
    pid: null,
  };
}
