const path = require('path');

module.exports = {
  apps: [
    {
      name: 'immersion-backend',
      cwd: path.resolve(__dirname, 'server'),
      script: 'pm2-start.mjs',
      watch: ['src'],
      watch_delay: 1000,
      autorestart: true,
      max_restarts: 10,
      treekill: false,   // Don't kill child processes (llama-server) on restart
      env: {
        PORT: 4777,
        NODE_ENV: 'development',
      },
    },
    {
      name: 'immersion-frontend',
      cwd: path.resolve(__dirname, 'client'),
      script: 'pm2-start.mjs',
      watch: false, // Vite HMR handles its own reloading
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
