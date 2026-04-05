import type { FastifyPluginAsync } from 'fastify';

import { approvedApiModules } from '../modules/index.js';

export const rootRoute: FastifyPluginAsync = async (app) => {
  app.get('/', async () => {
    return {
      name: 'immersion-api',
      phase: 'workspace-foundation',
      modules: approvedApiModules,
    };
  });
};
