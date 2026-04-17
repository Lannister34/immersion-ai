import {
  type ChatReplyGenerationResponse,
  ChatReplyGenerationResponseSchema,
  StartChatReplyGenerationCommandSchema,
} from '@immersion/contracts/generation';

import { appendChatMessages, ChatNotFoundError } from '../../chats/application/append-chat-messages.js';
import { getChatSession } from '../../chats/application/get-chat-session.js';
import { buildChatReplyPrompt } from '../../prompting/application/build-chat-reply-prompt.js';
import { GenerationProviderUnavailableError } from '../../providers/application/generation-provider.js';
import { resolveActiveSamplerPreset } from '../../settings/application/active-sampler-preset.js';
import { getSettingsOverview } from '../../settings/application/get-settings-overview.js';
import { OpenAiCompatibleChatCompletionsClient } from '../infrastructure/openai-compatible-chat-completions-client.js';
import type { ChatCompletionClient } from './chat-completion-client.js';
import { ChatReplyGenerationFailedError, ProviderGenerationError } from './generation-errors.js';

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
  const session = await getChatSession(command.chatId);

  if (!session) {
    throw new ChatNotFoundError(command.chatId);
  }

  const sessionAfterUserMessage = await appendChatMessages(command.chatId, [
    {
      role: 'user',
      content: command.message,
      createdAt: userMessageCreatedAt,
    },
  ]);
  const settings = getSettingsOverview();
  const activePreset = resolveActiveSamplerPreset(settings);
  const promptMessages = buildChatReplyPrompt({
    session: sessionAfterUserMessage,
    settings,
  });
  const chatCompletionClient = dependencies.chatCompletionClient ?? new OpenAiCompatibleChatCompletionsClient();
  let completion: Awaited<ReturnType<ChatCompletionClient['completeChat']>>;

  try {
    completion = await chatCompletionClient.completeChat({
      maxTokens: activePreset.maxTokens,
      messages: promptMessages,
      sampling: {
        minP: activePreset.minP,
        presencePenalty: activePreset.presencePenalty,
        repeatPenalty: activePreset.repeatPenalty,
        repeatPenaltyRange: activePreset.repeatPenaltyRange,
        temperature: activePreset.temperature,
        topK: activePreset.topK,
        topP: activePreset.topP,
      },
    });
  } catch (error) {
    if (error instanceof GenerationProviderUnavailableError) {
      throw new ChatReplyGenerationFailedError(
        409,
        'generation_provider_unavailable',
        error.message,
        sessionAfterUserMessage,
      );
    }

    if (error instanceof ProviderGenerationError) {
      throw new ChatReplyGenerationFailedError(
        502,
        'provider_generation_failed',
        error.message,
        sessionAfterUserMessage,
      );
    }

    throw error;
  }
  const sessionAfterGeneratedExchange = await appendChatMessages(command.chatId, [
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
