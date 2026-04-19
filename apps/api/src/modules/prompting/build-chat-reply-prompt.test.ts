import type { ChatSessionDto } from '@immersion/contracts/chats';
import type { SettingsOverviewResponse } from '@immersion/contracts/settings';
import { describe, expect, it } from 'vitest';
import type { ActiveSamplerPreset } from '../settings/application/active-sampler-preset.js';
import { buildChatReplyPrompt } from './application/build-chat-reply-prompt.js';

const settings: SettingsOverviewResponse = {
  profile: {
    responseLanguage: 'none',
    streamingEnabled: false,
    systemPromptTemplate: 'Global system prompt.',
    thinkingEnabled: true,
    uiLanguage: 'ru',
    userName: 'Tester',
    userPersona: '',
  },
  sampler: {
    activePresetId: 'default',
    modelBindingCount: 0,
    modelBindings: [],
    presets: [],
  },
};

const defaultSamplerPreset: ActiveSamplerPreset = {
  contextTrimStrategy: 'trim_middle',
  id: 'default',
  maxContextLength: 8192,
  maxTokens: 600,
  minP: 0,
  name: 'Default',
  presencePenalty: 0,
  repeatPenalty: 1,
  repeatPenaltyRange: 0,
  temperature: 1,
  topK: 0,
  topP: 1,
};

function buildSession(messages: ChatSessionDto['messages'], systemPrompt: string | null = null): ChatSessionDto {
  return {
    characterName: null,
    chat: {
      characterName: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      id: 'chat-1',
      lastMessagePreview: null,
      messageCount: messages.length,
      title: 'Prompt test',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    generationSettings: {
      samplerPresetId: null,
      sampling: {
        contextTrimStrategy: null,
        maxContextLength: null,
        maxTokens: null,
        minP: null,
        presencePenalty: null,
        repeatPenalty: null,
        repeatPenaltyRange: null,
        temperature: null,
        topK: null,
        topP: null,
      },
      systemPrompt,
    },
    messages,
    userName: 'Tester',
  };
}

describe('buildChatReplyPrompt', () => {
  it('uses a chat-owned system prompt instead of the global template', () => {
    const prompt = buildChatReplyPrompt({
      samplerPreset: defaultSamplerPreset,
      session: buildSession(
        [
          {
            content: 'Hello.',
            createdAt: '2026-01-01T00:00:00.000Z',
            id: 'm1',
            role: 'user',
          },
        ],
        'Chat-level system prompt for {{user}}.',
      ),
      settings,
    });

    expect(prompt[0]).toMatchObject({
      role: 'system',
      content: 'Chat-level system prompt for Tester.',
    });
    expect(prompt[0]?.content).not.toContain('Global system prompt.');
  });

  it('trims old transcript messages with trim_start when context budget is exceeded', () => {
    const prompt = buildChatReplyPrompt({
      samplerPreset: {
        ...defaultSamplerPreset,
        contextTrimStrategy: 'trim_start',
        maxContextLength: 10,
      },
      session: buildSession([
        {
          content: 'old message that should be trimmed',
          createdAt: '2026-01-01T00:00:00.000Z',
          id: 'm1',
          role: 'user',
        },
        {
          content: 'latest message stays even if it is large',
          createdAt: '2026-01-01T00:00:01.000Z',
          id: 'm2',
          role: 'user',
        },
      ]),
      settings,
    });

    expect(prompt.map((message) => message.content).join('\n')).not.toContain('old message');
    expect(prompt.map((message) => message.content).join('\n')).toContain('latest message');
  });

  it('trims middle transcript messages with trim_middle when context budget is exceeded', () => {
    const prompt = buildChatReplyPrompt({
      samplerPreset: {
        ...defaultSamplerPreset,
        contextTrimStrategy: 'trim_middle',
        maxContextLength: 32,
      },
      session: buildSession([
        {
          content: 'FIRST edge',
          createdAt: '2026-01-01T00:00:00.000Z',
          id: 'm1',
          role: 'user',
        },
        {
          content: 'MIDDLE '.repeat(20),
          createdAt: '2026-01-01T00:00:01.000Z',
          id: 'm2',
          role: 'assistant',
        },
        {
          content: 'LATEST edge',
          createdAt: '2026-01-01T00:00:02.000Z',
          id: 'm3',
          role: 'user',
        },
      ]),
      settings,
    });
    const content = prompt.map((message) => message.content).join('\n');

    expect(content).toContain('FIRST edge');
    expect(content).not.toContain('MIDDLE');
    expect(content).toContain('LATEST edge');
  });
});
