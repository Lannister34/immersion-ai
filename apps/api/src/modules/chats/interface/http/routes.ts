import { ChatIdSchema, CreateChatCommandSchema } from '@immersion/contracts/chats';
import { ApiProblemSchema } from '@immersion/contracts/common';
import type { FastifyPluginAsync } from 'fastify';
import { ZodError, z } from 'zod';

import { createChat } from '../../application/create-chat.js';
import { getChatSession } from '../../application/get-chat-session.js';
import { listChats } from '../../application/list-chats.js';

const ChatRouteParamsSchema = z.object({
  chatId: ChatIdSchema,
});

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

  return {
    statusCode: 500,
    body: ApiProblemSchema.parse({
      code: 'internal_error',
      message: 'Unexpected error.',
    }),
  };
}

export const chatsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (_request, reply) => {
    try {
      return await listChats();
    } catch (error) {
      _request.log.error({ err: error }, 'Failed to list generic chats');
      const problem = toProblem(error);

      return reply.status(problem.statusCode).send(problem.body);
    }
  });

  app.post('/', async (request, reply) => {
    try {
      const command = CreateChatCommandSchema.parse(request.body);
      const response = await createChat(command);

      return reply.status(201).send(response);
    } catch (error) {
      request.log.error({ err: error }, 'Failed to create generic chat');
      const problem = toProblem(error);

      return reply.status(problem.statusCode).send(problem.body);
    }
  });

  app.get('/:chatId', async (request, reply) => {
    try {
      const { chatId } = ChatRouteParamsSchema.parse(request.params);
      const session = await getChatSession(chatId);
      if (!session) {
        return reply.status(404).send({
          code: 'chat_not_found',
          message: 'Chat session not found.',
        });
      }

      return session;
    } catch (error) {
      request.log.error({ err: error }, 'Failed to load generic chat session');
      const problem = toProblem(error);

      return reply.status(problem.statusCode).send(problem.body);
    }
  });
};
