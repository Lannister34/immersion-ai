import type { ChatSessionDto } from '@immersion/contracts/chats';
import type { ChatReplyGenerationResponse, StartChatReplyGenerationCommand } from '@immersion/contracts/generation';
import { appendChatMessages } from '../../chats/application/append-chat-messages.js';
import { buildChatReplyPrompt } from '../../prompting/application/build-chat-reply-prompt.js';
import {
  GenerationProviderUnavailableError,
  resolveGenerationProviderEndpoint,
} from '../../providers/application/generation-provider.js';
import { getSettingsOverview } from '../../settings/application/get-settings-overview.js';
import { OpenAiCompatibleChatCompletionsClient } from '../infrastructure/openai-compatible-chat-completions-client.js';
import type { ChatCompletionClient } from './chat-completion-client.js';
import { resolveEffectiveSamplerPreset } from './effective-sampler.js';
import { ChatReplyGenerationFailedError, ProviderGenerationError } from './generation-errors.js';

export interface ChatReplyGenerationDependencies {
  chatCompletionClient?: ChatCompletionClient;
  now?: () => Date;
  signal?: AbortSignal;
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DOMException('Generation was canceled.', 'AbortError');
  }
}

export async function appendUserMessageForChatReply(
  command: StartChatReplyGenerationCommand,
  now: () => Date,
): Promise<ChatSessionDto> {
  return appendChatMessages(command.chatId, [
    {
      role: 'user',
      content: command.message,
      createdAt: now().toISOString(),
    },
  ]);
}

export async function completeChatReplyForSession(
  command: StartChatReplyGenerationCommand,
  sessionAfterUserMessage: ChatSessionDto,
  dependencies: ChatReplyGenerationDependencies = {},
): Promise<ChatReplyGenerationResponse> {
  const now = dependencies.now ?? (() => new Date());
  const settings = getSettingsOverview();
  const chatCompletionClient = dependencies.chatCompletionClient ?? new OpenAiCompatibleChatCompletionsClient();
  let completion: Awaited<ReturnType<ChatCompletionClient['completeChat']>>;

  try {
    throwIfAborted(dependencies.signal);

    const endpoint = await resolveGenerationProviderEndpoint();
    const activePreset = resolveEffectiveSamplerPreset(
      settings,
      endpoint.model,
      sessionAfterUserMessage.generationSettings,
    );
    const promptMessages = buildChatReplyPrompt({
      samplerPreset: activePreset,
      session: sessionAfterUserMessage,
      settings,
    });

    completion = await chatCompletionClient.completeChat({
      endpoint,
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
      signal: dependencies.signal,
    });

    throwIfAborted(dependencies.signal);
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

  return {
    session: sessionAfterGeneratedExchange,
  };
}
