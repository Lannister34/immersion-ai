import cors from '@fastify/cors';
import Fastify from 'fastify';

import { buildApiLogger } from './lib/logger.js';
import { chatsRoutes } from './modules/chats/interface/http/routes.js';
import { providersRoutes } from './modules/providers/interface/http/routes.js';
import { runtimeRoutes } from './modules/runtime/interface/http/routes.js';
import { settingsRoutes } from './modules/settings/interface/http/routes.js';
import { healthRoute } from './routes/health.js';
import { rootRoute } from './routes/root.js';

export function buildApiApp() {
  const app = Fastify({
    loggerInstance: buildApiLogger(),
  });

  app.register(cors, {
    origin: true,
  });
  app.register(rootRoute);
  app.register(healthRoute, { prefix: '/health' });
  app.register(chatsRoutes, { prefix: '/api/chats' });
  app.register(settingsRoutes, { prefix: '/api/settings' });
  app.register(providersRoutes, { prefix: '/api/providers' });
  app.register(runtimeRoutes, { prefix: '/api/runtime' });

  return app;
}
