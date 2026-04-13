import type { ChatSessionDto } from '@immersion/contracts/chats';
import type { SettingsOverviewResponse } from '@immersion/contracts/settings';

import { assembleBasePrompt } from './assemble-base-prompt.js';
import { buildPromptInputSnapshot, type PromptTranscriptRole } from './prompt-input-snapshot.js';

export type ChatReplyPromptRole = 'assistant' | 'system' | 'user';

export interface ChatReplyPromptMessage {
  content: string;
  role: ChatReplyPromptRole;
}

export interface BuildChatReplyPromptInput {
  session: ChatSessionDto;
  settings: SettingsOverviewResponse;
}

const DEFAULT_SYSTEM_PROMPT_TEMPLATE =
  'You are a helpful local assistant. Answer the user directly and keep the conversation coherent.';

function toPromptTranscriptRole(role: ChatSessionDto['messages'][number]['role']): PromptTranscriptRole {
  return role;
}

function getActiveContextLength(settings: SettingsOverviewResponse) {
  const activePreset = settings.sampler.presets.find((preset) => preset.id === settings.sampler.activePresetId);

  return activePreset?.maxContextLength && activePreset.maxContextLength > 0 ? activePreset.maxContextLength : 8192;
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

export function buildChatReplyPrompt(input: BuildChatReplyPromptInput): ChatReplyPromptMessage[] {
  const snapshot = buildPromptInputSnapshot({
    chat: {
      id: input.session.chat.id,
      title: input.session.chat.title,
      transcript: input.session.messages.map((message) => ({
        content: message.content,
        id: message.id,
        role: toPromptTranscriptRole(message.role),
      })),
    },
    generation: {
      maxContextTokens: getActiveContextLength(input.settings),
      replyMaxTokens: 512,
      trimStrategy: 'trim_start',
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

  return messages;
}
