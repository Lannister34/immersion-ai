import { spawnSync } from 'node:child_process';

const REWRITE_PREFIXES = ['apps/', 'packages/'];
const REWRITE_FILES = new Set([
  '.github/workflows/ci.yml',
  '.gitignore',
  '.husky/pre-commit',
  '.husky/pre-push',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'tsconfig.rewrite.json',
]);

function quoteWindowsArg(arg) {
  if (!arg.length) {
    return '""';
  }

  if (!/[\s"]/u.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`;
}

function resolveCommand(command, args) {
  if (process.platform !== 'win32') {
    return { command, args };
  }

  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', [command, ...args].map(quoteWindowsArg).join(' ')],
  };
}

function run(command, args, options = {}) {
  const resolved = resolveCommand(command, args);
  const result = spawnSync(resolved.command, resolved.args, {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      HUSKY: '0',
    },
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim();
}

function resolveBaseRef() {
  const currentBranch = capture('git', ['branch', '--show-current']);
  const originDev = capture('git', ['rev-parse', '--verify', 'origin/dev']);

  if (originDev && currentBranch && currentBranch !== 'dev') {
    return 'origin/dev';
  }

  const upstream = capture('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  if (upstream) {
    return upstream;
  }

  if (originDev) {
    return 'origin/dev';
  }

  return null;
}

function getChangedFiles() {
  const baseRef = resolveBaseRef();
  const diffArgs = baseRef ? ['diff', '--name-only', `${baseRef}...HEAD`] : ['diff', '--cached', '--name-only'];
  const stdout = capture('git', diffArgs);

  if (!stdout) {
    return [];
  }

  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function touchesRewrite(changedFiles) {
  return changedFiles.some((filePath) => {
    if (REWRITE_FILES.has(filePath)) {
      return true;
    }

    if (filePath.startsWith('scripts/')) {
      return true;
    }

    return REWRITE_PREFIXES.some((prefix) => filePath.startsWith(prefix));
  });
}

const changedFiles = getChangedFiles();

console.log('[pre-push] Running legacy baseline verification...');
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'check']);

if (!touchesRewrite(changedFiles)) {
  console.log('[pre-push] No rewrite paths changed; skipping clean rewrite preflight.');
  process.exit(0);
}

console.log('[pre-push] Rewrite paths changed; running clean checkout rewrite preflight...');
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'rewrite:ci:clean']);
