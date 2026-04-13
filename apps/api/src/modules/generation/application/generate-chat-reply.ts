import {
  type ChatReplyGenerationResponse,
  ChatReplyGenerationResponseSchema,
  StartChatReplyGenerationCommandSchema,
} from '@immersion/contracts/generation';

import { appendChatMessages } from '../../chats/application/append-chat-messages.js';
import { buildChatReplyPrompt } from '../../prompting/application/build-chat-reply-prompt.js';
import { getSettingsOverview } from '../../settings/application/get-settings-overview.js';
import { OpenAiCompatibleChatCompletionsClient } from '../infrastructure/openai-compatible-chat-completions-client.js';
import type { ChatCompletionClient } from './chat-completion-client.js';

export interface GenerateChatReplyDependencies {
  chatCompletionClient?: ChatCompletionClient;
  now?: () => Date;
}

export async function generateChatReply(
  input: unknown,
  dependencies: GenerateChatReplyDependencies = {},
): Promise<ChatReplyGenerationResponse> {
  const command = StartChatReplyGenerationCommandSchema.parse(input);
  const now = dependencies.now ?? (() => new Date());
  const userMessageCreatedAt = now().toISOString();
  const sessionAfterUserMessage = await appendChatMessages(command.chatId, [
    {
      role: 'user',
      content: command.message,
      createdAt: userMessageCreatedAt,
    },
  ]);
  const settings = getSettingsOverview();
  const promptMessages = buildChatReplyPrompt({
    session: sessionAfterUserMessage,
    settings,
  });
  const chatCompletionClient = dependencies.chatCompletionClient ?? new OpenAiCompatibleChatCompletionsClient();
  const completion = await chatCompletionClient.completeChat({
    maxTokens: 512,
    messages: promptMessages,
  });
  const sessionAfterAssistantReply = await appendChatMessages(command.chatId, [
    {
      role: 'assistant',
      content: completion.content,
      createdAt: now().toISOString(),
    },
  ]);

  return ChatReplyGenerationResponseSchema.parse({
    session: sessionAfterAssistantReply,
  });
}
