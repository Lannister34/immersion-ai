import type { ChatSessionDto } from '@immersion/contracts/chats';
import {
  type ChatReplyGenerationResponse,
  ChatReplyGenerationResponseSchema,
  StartChatReplyGenerationCommandSchema,
} from '@immersion/contracts/generation';

import { appendChatMessages, ChatNotFoundError } from '../../chats/application/append-chat-messages.js';
import { getChatSession } from '../../chats/application/get-chat-session.js';
import { buildChatReplyPrompt } from '../../prompting/application/build-chat-reply-prompt.js';
import { getSettingsOverview } from '../../settings/application/get-settings-overview.js';
import { OpenAiCompatibleChatCompletionsClient } from '../infrastructure/openai-compatible-chat-completions-client.js';
import type { ChatCompletionClient } from './chat-completion-client.js';

export interface GenerateChatReplyDependencies {
  chatCompletionClient?: ChatCompletionClient;
  now?: () => Date;
}

function withTransientUserMessage(session: ChatSessionDto, content: string, createdAt: string): ChatSessionDto {
  return {
    ...session,
    messages: [
      ...session.messages,
      {
        id: `${session.chat.id}:pending-user`,
        role: 'user',
        content,
        createdAt,
      },
    ],
  };
}

export async function generateChatReply(
  input: unknown,
  dependencies: GenerateChatReplyDependencies = {},
): Promise<ChatReplyGenerationResponse> {
  const command = StartChatReplyGenerationCommandSchema.parse(input);
  const now = dependencies.now ?? (() => new Date());
  const userMessageCreatedAt = now().toISOString();
  const session = await getChatSession(command.chatId);

  if (!session) {
    throw new ChatNotFoundError(command.chatId);
  }

  const settings = getSettingsOverview();
  const promptMessages = buildChatReplyPrompt({
    session: withTransientUserMessage(session, command.message, userMessageCreatedAt),
    settings,
  });
  const chatCompletionClient = dependencies.chatCompletionClient ?? new OpenAiCompatibleChatCompletionsClient();
  const completion = await chatCompletionClient.completeChat({
    maxTokens: 512,
    messages: promptMessages,
  });
  const sessionAfterGeneratedExchange = await appendChatMessages(command.chatId, [
    {
      role: 'user',
      content: command.message,
      createdAt: userMessageCreatedAt,
    },
    {
      role: 'assistant',
      content: completion.content,
      createdAt: now().toISOString(),
    },
  ]);

  return ChatReplyGenerationResponseSchema.parse({
    session: sessionAfterGeneratedExchange,
  });
}
