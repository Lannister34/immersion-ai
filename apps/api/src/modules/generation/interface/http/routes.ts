import { ApiProblemSchema } from '@immersion/contracts/common';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';

import { ChatNotFoundError } from '../../../chats/application/append-chat-messages.js';
import { GenerationProviderUnavailableError } from '../../../providers/application/generation-provider.js';
import { generateChatReply } from '../../application/generate-chat-reply.js';
import { ProviderGenerationError } from '../../application/generation-errors.js';

function toProblem(error: unknown) {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: ApiProblemSchema.parse({
        code: 'validation_error',
        message: error.issues[0]?.message ?? 'Invalid request payload.',
      }),
    };
  }

  if (error instanceof ChatNotFoundError) {
    return {
      statusCode: 404,
      body: ApiProblemSchema.parse({
        code: 'chat_not_found',
        message: 'Chat session not found.',
      }),
    };
  }

  if (error instanceof GenerationProviderUnavailableError) {
    return {
      statusCode: 409,
      body: ApiProblemSchema.parse({
        code: 'generation_provider_unavailable',
        message: error.message,
      }),
    };
  }

  if (error instanceof ProviderGenerationError) {
    return {
      statusCode: 502,
      body: ApiProblemSchema.parse({
        code: 'provider_generation_failed',
        message: error.message,
      }),
    };
  }

  return {
    statusCode: 500,
    body: ApiProblemSchema.parse({
      code: 'internal_error',
      message: 'Unexpected error.',
    }),
  };
}

export const generationRoutes: FastifyPluginAsync = async (app) => {
  app.post('/chat-reply', async (request, reply) => {
    try {
      return await generateChatReply(request.body);
    } catch (error) {
      request.log.error({ err: error }, 'Failed to generate chat reply');
      const problem = toProblem(error);

      return reply.status(problem.statusCode).send(problem.body);
    }
  });
};
