import type { ChatSessionDto } from '@immersion/contracts/chats';
import type { SettingsOverviewResponse } from '@immersion/contracts/settings';

import {
  type ActiveSamplerPreset,
  resolveActiveSamplerPreset,
} from '../../settings/application/active-sampler-preset.js';
import { assembleBasePrompt } from './assemble-base-prompt.js';
import { buildPromptInputSnapshot, type PromptTranscriptRole } from './prompt-input-snapshot.js';

export type ChatReplyPromptRole = 'assistant' | 'system' | 'user';

export interface ChatReplyPromptMessage {
  content: string;
  role: ChatReplyPromptRole;
}

export interface BuildChatReplyPromptInput {
  samplerPreset?: ActiveSamplerPreset;
  session: ChatSessionDto;
  settings: SettingsOverviewResponse;
}

const DEFAULT_SYSTEM_PROMPT_TEMPLATE =
  'You are a helpful local assistant. Answer the user directly and keep the conversation coherent.';

function toPromptTranscriptRole(role: ChatSessionDto['messages'][number]['role']): PromptTranscriptRole {
  return role;
}

function getLanguageInstruction(responseLanguage: SettingsOverviewResponse['profile']['responseLanguage']) {
  if (responseLanguage === 'ru') {
    return 'Answer in Russian unless the user explicitly asks for another language.';
  }

  if (responseLanguage === 'en') {
    return 'Answer in English unless the user explicitly asks for another language.';
  }

  return null;
}

function estimatePromptTokens(message: ChatReplyPromptMessage) {
  return Math.max(1, Math.ceil(`${message.role}\n${message.content}`.length / 4));
}

function trimFromStart(messages: ChatReplyPromptMessage[], tokenBudget: number) {
  const keptMessages: ChatReplyPromptMessage[] = [];
  let remainingTokens = tokenBudget;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    const estimatedTokens = estimatePromptTokens(message);

    if (keptMessages.length > 0 && estimatedTokens > remainingTokens) {
      break;
    }

    keptMessages.push(message);
    remainingTokens -= estimatedTokens;
  }

  return keptMessages.reverse();
}

function trimFromMiddle(messages: ChatReplyPromptMessage[], tokenBudget: number) {
  if (messages.length <= 1) {
    return messages;
  }

  const keptIndexes = new Set<number>();
  const latestIndex = messages.length - 1;
  let remainingTokens = tokenBudget - estimatePromptTokens(messages[latestIndex]!);

  keptIndexes.add(latestIndex);

  let leftIndex = 0;
  let rightIndex = latestIndex - 1;
  let takeLeft = true;

  while (leftIndex <= rightIndex) {
    const candidateIndex = takeLeft ? leftIndex : rightIndex;
    const candidate = messages[candidateIndex]!;
    const estimatedTokens = estimatePromptTokens(candidate);

    if (estimatedTokens > remainingTokens) {
      break;
    }

    keptIndexes.add(candidateIndex);
    remainingTokens -= estimatedTokens;

    if (takeLeft) {
      leftIndex += 1;
    } else {
      rightIndex -= 1;
    }

    takeLeft = !takeLeft;
  }

  return messages.filter((_, index) => keptIndexes.has(index));
}

function trimTranscriptToContextBudget(
  messages: ChatReplyPromptMessage[],
  samplerPreset: ActiveSamplerPreset,
): ChatReplyPromptMessage[] {
  if (samplerPreset.maxContextLength <= 0) {
    return messages.at(-1) ? [messages.at(-1)!] : [];
  }

  const systemMessages = messages.filter((message) => message.role === 'system');
  const transcriptMessages = messages.filter((message) => message.role !== 'system');
  const totalEstimatedTokens = messages.reduce((total, message) => total + estimatePromptTokens(message), 0);

  if (totalEstimatedTokens <= samplerPreset.maxContextLength) {
    return messages;
  }

  const reservedSystemTokens = systemMessages.reduce((total, message) => total + estimatePromptTokens(message), 0);
  const transcriptBudget = Math.max(1, samplerPreset.maxContextLength - reservedSystemTokens);
  const trimmedTranscript =
    samplerPreset.contextTrimStrategy === 'trim_start'
      ? trimFromStart(transcriptMessages, transcriptBudget)
      : trimFromMiddle(transcriptMessages, transcriptBudget);

  return [...systemMessages, ...trimmedTranscript];
}

export function buildChatReplyPrompt(input: BuildChatReplyPromptInput): ChatReplyPromptMessage[] {
  const activePreset = input.samplerPreset ?? resolveActiveSamplerPreset(input.settings);
  const snapshot = buildPromptInputSnapshot({
    chat: {
      customSystemPrompt: input.session.generationSettings.systemPrompt,
      id: input.session.chat.id,
      title: input.session.chat.title,
      transcript: input.session.messages.map((message) => ({
        content: message.content,
        id: message.id,
        role: toPromptTranscriptRole(message.role),
      })),
    },
    generation: {
      maxContextTokens: activePreset.maxContextLength,
      replyMaxTokens: activePreset.maxTokens,
      trimStrategy: activePreset.contextTrimStrategy,
    },
    settings: {
      defaultSystemPromptTemplate: DEFAULT_SYSTEM_PROMPT_TEMPLATE,
      responseLanguage: input.settings.profile.responseLanguage,
      systemPromptTemplate: input.settings.profile.systemPromptTemplate.trim() || null,
      thinkingEnabled: input.settings.profile.thinkingEnabled,
    },
    user: {
      name: input.session.userName,
      persona: input.settings.profile.userPersona,
    },
  });
  const basePrompt = assembleBasePrompt(snapshot);
  const systemSections = [basePrompt.prompt, getLanguageInstruction(input.settings.profile.responseLanguage)].filter(
    (section): section is string => section !== null && section.trim().length > 0,
  );
  const messages: ChatReplyPromptMessage[] = [];

  if (systemSections.length > 0) {
    messages.push({
      role: 'system',
      content: systemSections.join('\n\n'),
    });
  }

  for (const message of input.session.messages) {
    if (message.content.trim().length === 0) {
      continue;
    }

    messages.push({
      role: message.role,
      content: message.content,
    });
  }

  return trimTranscriptToContextBudget(messages, activePreset);
}
