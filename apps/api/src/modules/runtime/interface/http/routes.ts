import type { FastifyPluginAsync } from 'fastify';

import { getRuntimeOverview } from '../../application/get-runtime-overview.js';

export const runtimeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/overview', async () => getRuntimeOverview());
};
