const path = require('path');
const node = process.execPath;

module.exports = {
  apps: [
    {
      name: 'immersion-rewrite-api',
      cwd: path.resolve(__dirname, 'apps/api'),
      script: path.resolve(__dirname, 'apps/api/node_modules/tsx/dist/cli.mjs'),
      args: 'watch src/server.ts',
      interpreter: node,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
        IMMERSION_API_PORT: 4787,
        IMMERSION_DATA_ROOT: 'D:\\Neuro\\Immersion AI\\data',
      },
    },
    {
      name: 'immersion-rewrite-web',
      cwd: path.resolve(__dirname, 'apps/web'),
      script: path.resolve(__dirname, 'apps/web/node_modules/vite/bin/vite.js'),
      args: '--host 127.0.0.1 --port 4788',
      interpreter: node,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
        VITE_API_BASE_URL: 'http://127.0.0.1:4787',
      },
    },
  ],
};
