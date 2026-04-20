import { ApiProblemSchema } from '@immersion/contracts/common';
import { ChatReplyGenerationErrorResponseSchema } from '@immersion/contracts/generation';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError } from 'zod';

import { ChatNotFoundError } from '../../../chats/application/append-chat-messages.js';
import { GenerationProviderUnavailableError } from '../../../providers/application/generation-provider.js';
import { generateChatReply } from '../../application/generate-chat-reply.js';
import { ChatReplyGenerationFailedError, ProviderGenerationError } from '../../application/generation-errors.js';
import { getGenerationReadiness } from '../../application/get-generation-readiness.js';

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

  if (error instanceof ChatReplyGenerationFailedError) {
    return {
      statusCode: error.statusCode,
      body: ChatReplyGenerationErrorResponseSchema.parse({
        code: error.code,
        message: error.message,
        session: error.session,
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
  app.get('/readiness', async () => getGenerationReadiness());

  app.post('/chat-reply', async (request, reply) => {
    const abortController = new AbortController();
    const abortGeneration = () => abortController.abort();

    request.raw.once('aborted', abortGeneration);

    try {
      return await generateChatReply(request.body, {
        signal: abortController.signal,
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to generate chat reply');
      const problem = toProblem(error);

      return reply.status(problem.statusCode).send(problem.body);
    } finally {
      request.raw.off('aborted', abortGeneration);
    }
  });
};
