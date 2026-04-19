import {
  type ChatGenerationSettingsDto,
  type GetChatSessionResponse,
  GetChatSessionResponseSchema,
} from '@immersion/contracts/chats';

import type { ChatGenerationSettingsRecord, ChatSessionRecord } from './chat-records.js';
import { getDefaultUserName } from './default-user-name.js';

function toChatGenerationSettingsDto(settings: ChatGenerationSettingsRecord): ChatGenerationSettingsDto {
  return {
    samplerPresetId: settings.samplerPresetId,
    sampling: {
      contextTrimStrategy: settings.sampling.contextTrimStrategy,
      maxContextLength: settings.sampling.maxContextLength,
      maxTokens: settings.sampling.maxTokens,
      minP: settings.sampling.minP,
      presencePenalty: settings.sampling.presencePenalty,
      repeatPenalty: settings.sampling.repeatPenalty,
      repeatPenaltyRange: settings.sampling.repeatPenaltyRange,
      temperature: settings.sampling.temperature,
      topK: settings.sampling.topK,
      topP: settings.sampling.topP,
    },
    systemPrompt: settings.systemPrompt,
  };
}

export function toChatSessionResponse(session: ChatSessionRecord): GetChatSessionResponse {
  return GetChatSessionResponseSchema.parse({
    characterName: session.characterName,
    chat: session.chat,
    generationSettings: toChatGenerationSettingsDto(session.generationSettings),
    messages: session.messages,
    userName: session.userName ?? getDefaultUserName(),
  });
}
