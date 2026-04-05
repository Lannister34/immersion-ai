import type { FastifyPluginAsync } from 'fastify';

import { getSettingsOverview } from '../../application/get-settings-overview.js';

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/overview', async () => getSettingsOverview());
};
