import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';

import { getRuntimeOverview } from '../../application/get-runtime-overview.js';
import { startRuntime } from '../../application/start-runtime.js';
import { stopRuntime } from '../../application/stop-runtime.js';
import { updateRuntimeConfig } from '../../application/update-runtime-config.js';

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

  if (error instanceof Error && error.message.startsWith('Model not found:')) {
    return {
      statusCode: 400,
      body: {
        code: 'validation_error',
        message: error.message,
      },
    };
  }

  if (error instanceof Error && error.message.includes('llama-server не найден')) {
    return {
      statusCode: 409,
      body: {
        code: 'runtime_unavailable',
        message: error.message,
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

export const runtimeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/overview', async () => getRuntimeOverview());

  app.put('/config', async (request, reply) => {
    try {
      return await updateRuntimeConfig(request.body);
    } catch (error) {
      const problem = toProblem(error);

      return reply.status(problem.statusCode).send(problem.body);
    }
  });

  app.post('/start', async (request, reply) => {
    try {
      return await startRuntime(request.body);
    } catch (error) {
      const problem = toProblem(error);

      return reply.status(problem.statusCode).send(problem.body);
    }
  });

  app.post('/stop', async (_request, reply) => {
    try {
      return await stopRuntime();
    } catch (error) {
      const problem = toProblem(error);

      return reply.status(problem.statusCode).send(problem.body);
    }
  });
};
