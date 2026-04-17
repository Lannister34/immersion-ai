import { z } from 'zod';

import {
  resolveChatCompletionsUrl,
  resolveGenerationProviderEndpoint,
} from '../../providers/application/generation-provider.js';
import type {
  ChatCompletionClient,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '../application/chat-completion-client.js';
import { ProviderGenerationError } from '../application/generation-errors.js';

const OpenAiCompatibleChatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
        }),
      }),
    )
    .min(1),
});

function buildHeaders(apiKey: string | null) {
  return {
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export class OpenAiCompatibleChatCompletionsClient implements ChatCompletionClient {
  async completeChat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const endpoint = await resolveGenerationProviderEndpoint();
    let response: Response;

    try {
      response = await fetch(resolveChatCompletionsUrl(endpoint), {
        method: 'POST',
        headers: buildHeaders(endpoint.apiKey),
        body: JSON.stringify({
          model: endpoint.model,
          messages: request.messages,
          max_tokens: request.maxTokens,
          min_p: request.sampling.minP,
          presence_penalty: request.sampling.presencePenalty,
          rep_pen: request.sampling.repeatPenalty,
          rep_pen_range: request.sampling.repeatPenaltyRange,
          stream: false,
          temperature: request.sampling.temperature,
          top_k: request.sampling.topK,
          top_p: request.sampling.topP,
        }),
        signal: AbortSignal.timeout(10 * 60 * 1000),
      });
    } catch (error) {
      throw new ProviderGenerationError(error instanceof Error ? error.message : 'Provider request failed.');
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new ProviderGenerationError(
        `Provider returned HTTP ${response.status}${responseText ? `: ${responseText.slice(0, 500)}` : ''}`,
      );
    }

    let payload: z.infer<typeof OpenAiCompatibleChatCompletionResponseSchema>;

    try {
      payload = OpenAiCompatibleChatCompletionResponseSchema.parse(JSON.parse(responseText));
    } catch (error) {
      throw new ProviderGenerationError(
        error instanceof Error
          ? `Provider returned an invalid response: ${error.message}`
          : 'Provider returned an invalid response.',
      );
    }

    const content = payload.choices[0]?.message.content?.trim();

    if (!content) {
      throw new ProviderGenerationError('Provider returned an empty reply.');
    }

    return {
      content,
    };
  }
}
