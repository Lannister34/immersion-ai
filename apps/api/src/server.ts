import { buildApiApp } from './app.js';

const app = buildApiApp();

async function startServer() {
  try {
    await app.listen({
      host: '0.0.0.0',
      port: Number.parseInt(process.env.IMMERSION_API_PORT ?? '4787', 10),
    });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

void startServer();
