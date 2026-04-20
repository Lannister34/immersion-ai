import type { ChatSessionDto } from '@immersion/contracts/chats';
import {
  StartChatReplyGenerationCommandSchema,
  type StartChatReplyGenerationJobResponse,
  StartChatReplyGenerationJobResponseSchema,
} from '@immersion/contracts/generation';

import { ChatNotFoundError } from '../../chats/application/append-chat-messages.js';
import { getChatSession } from '../../chats/application/get-chat-session.js';
import type { ChatCompletionClient } from './chat-completion-client.js';
import { appendUserMessageForChatReply, completeChatReplyForSession } from './chat-reply-generation.js';
import type { GenerationJobRegistry } from './generation-job-registry.js';

export interface StartChatReplyGenerationJobDependencies {
  chatCompletionClient?: ChatCompletionClient;
  generationJobRegistry: GenerationJobRegistry;
  now?: () => Date;
}

export async function startChatReplyGenerationJob(
  input: unknown,
  dependencies: StartChatReplyGenerationJobDependencies,
): Promise<StartChatReplyGenerationJobResponse> {
  const command = StartChatReplyGenerationCommandSchema.parse(input);
  const now = dependencies.now ?? (() => new Date());
  const session = await getChatSession(command.chatId);

  if (!session) {
    throw new ChatNotFoundError(command.chatId);
  }

  const job = dependencies.generationJobRegistry.createChatReplyJob({
    chatId: command.chatId,
    command,
  });
  let sessionAfterUserMessage: ChatSessionDto;

  try {
    sessionAfterUserMessage = await appendUserMessageForChatReply(command, now);
  } catch (error) {
    dependencies.generationJobRegistry.fail(job.id, error);
    throw error;
  }

  dependencies.generationJobRegistry.runChatReplyJob(job.id, async ({ signal }) => {
    const response = await completeChatReplyForSession(command, sessionAfterUserMessage, {
      ...(dependencies.chatCompletionClient ? { chatCompletionClient: dependencies.chatCompletionClient } : {}),
      now,
      signal,
    });

    return response.session;
  });

  return StartChatReplyGenerationJobResponseSchema.parse({
    job,
    session: sessionAfterUserMessage,
  });
}
