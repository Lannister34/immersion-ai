import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';
import { getProviderSettings } from '../../application/get-provider-settings.js';
import { getProvidersOverview } from '../../application/get-providers-overview.js';
import { testProviderConnection } from '../../application/test-provider-connection.js';
import { updateProviderSettings } from '../../application/update-provider-settings.js';
import { providerDefinitions } from '../../domain/provider-catalog.js';

function toProblem(error: unknown) {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        code: 'validation_error',
        message: error.issues[0]?.message ?? 'Invalid request payload.',
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      code: 'internal_error',
      message: error instanceof Error ? error.message : 'Unexpected error.',
    },
  };
}

export const providersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/overview', async () => getProvidersOverview());

  app.get('/definitions', async () => {
    return {
      items: providerDefinitions,
    };
  });

  app.get('/connection', async (_request, reply) => {
    try {
      return await testProviderConnection();
    } catch (error) {
      const problem = toProblem(error);

      return reply.status(problem.statusCode).send(problem.body);
    }
  });

  app.get('/settings', async (_request, reply) => {
    try {
      return await getProviderSettings();
    } catch (error) {
      const problem = toProblem(error);

      return reply.status(problem.statusCode).send(problem.body);
    }
  });

  app.put('/settings', async (request, reply) => {
    try {
      return await updateProviderSettings(request.body);
    } catch (error) {
      const problem = toProblem(error);

      return reply.status(problem.statusCode).send(problem.body);
    }
  });
};
