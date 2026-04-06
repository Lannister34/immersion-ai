import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      HUSKY: '0',
    },
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${result.status ?? 1}`);
  }
}

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'immersion-rewrite-ci-'));
let worktreeAdded = false;

try {
  console.log(`[rewrite-ci-clean] Creating clean worktree at ${tempDir}`);
  run('git', ['worktree', 'add', '--detach', tempDir, 'HEAD']);
  worktreeAdded = true;

  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  console.log('[rewrite-ci-clean] Installing dependencies from lockfile in clean checkout...');
  run(pnpm, ['install', '--frozen-lockfile'], { cwd: tempDir });

  console.log('[rewrite-ci-clean] Running rewrite CI in clean checkout...');
  run(npm, ['run', 'rewrite:ci'], { cwd: tempDir });
} finally {
  if (worktreeAdded) {
    console.log('[rewrite-ci-clean] Removing temporary worktree...');
    try {
      run('git', ['worktree', 'remove', tempDir, '--force']);
    } catch {
      rmSync(tempDir, { force: true, recursive: true });
    }
  } else {
    rmSync(tempDir, { force: true, recursive: true });
  }
}
