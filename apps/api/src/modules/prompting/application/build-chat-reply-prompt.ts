import type { ChatSessionDto } from '@immersion/contracts/chats';
import type { SettingsOverviewResponse } from '@immersion/contracts/settings';

import type { ActiveSamplerPreset } from '../../settings/application/active-sampler-preset.js';
import { assembleBasePrompt, type BasePromptAssemblyResult } from './assemble-base-prompt.js';
import { buildPromptInputSnapshot, type PromptTranscriptRole } from './prompt-input-snapshot.js';

export type ChatReplyPromptRole = 'assistant' | 'system' | 'user';

export interface ChatReplyPromptMessage {
  content: string;
  role: ChatReplyPromptRole;
}

export interface ChatReplyPromptTokenEstimate {
  finalTotal: number;
  promptBudget: number;
  replyReservation: number;
  system: number;
  transcriptAfterTrim: number;
  transcriptBeforeTrim: number;
}

export interface ChatReplyPromptDiagnostics {
  promptSource: BasePromptAssemblyResult['source'];
  renderer: BasePromptAssemblyResult['diagnostics'];
  tokenEstimate: ChatReplyPromptTokenEstimate;
  trimmedMessageCount: number;
}

export interface ChatReplyPromptBundle {
  diagnostics: ChatReplyPromptDiagnostics;
  messages: ChatReplyPromptMessage[];
}

export interface BuildChatReplyPromptInput {
  samplerPreset: ActiveSamplerPreset;
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

function estimateMessages(messages: ChatReplyPromptMessage[]) {
  return messages.reduce((total, message) => total + estimatePromptTokens(message), 0);
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
): {
  messages: ChatReplyPromptMessage[];
  tokenEstimate: ChatReplyPromptTokenEstimate;
  trimmedMessageCount: number;
} {
  const systemMessages = messages.filter((message) => message.role === 'system');
  const transcriptMessages = messages.filter((message) => message.role !== 'system');
  const systemTokens = estimateMessages(systemMessages);
  const transcriptBeforeTrimTokens = estimateMessages(transcriptMessages);
  const promptBudget =
    samplerPreset.maxContextLength <= 0 ? 0 : Math.max(1, samplerPreset.maxContextLength - samplerPreset.maxTokens);

  if (samplerPreset.maxContextLength <= 0) {
    const latestMessage = messages.at(-1);
    const trimmedMessages = latestMessage ? [latestMessage] : [];
    const transcriptAfterTrimTokens = estimateMessages(trimmedMessages.filter((message) => message.role !== 'system'));

    return {
      messages: trimmedMessages,
      tokenEstimate: {
        finalTotal: estimateMessages(trimmedMessages),
        promptBudget,
        replyReservation: samplerPreset.maxTokens,
        system: 0,
        transcriptAfterTrim: transcriptAfterTrimTokens,
        transcriptBeforeTrim: transcriptBeforeTrimTokens,
      },
      trimmedMessageCount: Math.max(0, transcriptMessages.length - trimmedMessages.length),
    };
  }

  const totalEstimatedTokens = systemTokens + transcriptBeforeTrimTokens;

  if (totalEstimatedTokens <= promptBudget) {
    return {
      messages,
      tokenEstimate: {
        finalTotal: totalEstimatedTokens,
        promptBudget,
        replyReservation: samplerPreset.maxTokens,
        system: systemTokens,
        transcriptAfterTrim: transcriptBeforeTrimTokens,
        transcriptBeforeTrim: transcriptBeforeTrimTokens,
      },
      trimmedMessageCount: 0,
    };
  }

  const transcriptBudget = Math.max(1, promptBudget - systemTokens);
  const trimmedTranscript =
    samplerPreset.contextTrimStrategy === 'trim_start'
      ? trimFromStart(transcriptMessages, transcriptBudget)
      : trimFromMiddle(transcriptMessages, transcriptBudget);
  const trimmedMessages = [...systemMessages, ...trimmedTranscript];
  const transcriptAfterTrimTokens = estimateMessages(trimmedTranscript);

  return {
    messages: trimmedMessages,
    tokenEstimate: {
      finalTotal: systemTokens + transcriptAfterTrimTokens,
      promptBudget,
      replyReservation: samplerPreset.maxTokens,
      system: systemTokens,
      transcriptAfterTrim: transcriptAfterTrimTokens,
      transcriptBeforeTrim: transcriptBeforeTrimTokens,
    },
    trimmedMessageCount: transcriptMessages.length - trimmedTranscript.length,
  };
}

export function buildChatReplyPromptBundle(input: BuildChatReplyPromptInput): ChatReplyPromptBundle {
  const activePreset = input.samplerPreset;
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

  const budgetedPrompt = trimTranscriptToContextBudget(messages, activePreset);

  return {
    diagnostics: {
      promptSource: basePrompt.source,
      renderer: basePrompt.diagnostics,
      tokenEstimate: budgetedPrompt.tokenEstimate,
      trimmedMessageCount: budgetedPrompt.trimmedMessageCount,
    },
    messages: budgetedPrompt.messages,
  };
}

export function buildChatReplyPrompt(input: BuildChatReplyPromptInput): ChatReplyPromptMessage[] {
  return buildChatReplyPromptBundle(input).messages;
}
