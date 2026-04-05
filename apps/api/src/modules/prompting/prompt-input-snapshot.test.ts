import { describe, expect, it } from 'vitest';

import { buildPromptInputSnapshot } from './application/prompt-input-snapshot.js';

describe('prompt input snapshot', () => {
  it('normalizes optional fields to explicit nulls and clones mutable inputs', () => {
    const transcript = [
      {
        content: 'Привет.',
        id: 'm1',
        role: 'user' as const,
      },
    ];
    const knownDefaultTemplates = ['DEFAULT_PROMPT'];

    const snapshot = buildPromptInputSnapshot({
      chat: {
        id: 'chat-1',
        transcript,
      },
      generation: {
        maxContextTokens: 8192,
        replyMaxTokens: 600,
        trimStrategy: 'trim_middle',
      },
      settings: {
        defaultSystemPromptTemplate: 'DEFAULT_PROMPT',
        knownDefaultSystemPromptTemplates: knownDefaultTemplates,
        responseLanguage: 'ru',
        thinkingEnabled: true,
      },
    });

    transcript[0]!.content = 'Изменено';
    knownDefaultTemplates.push('LEGACY_PROMPT');

    expect(snapshot).toEqual({
      character: null,
      chat: {
        customSystemPrompt: null,
        customUserName: null,
        customUserPersona: null,
        id: 'chat-1',
        title: null,
        transcript: [
          {
            content: 'Привет.',
            id: 'm1',
            role: 'user',
          },
        ],
      },
      generation: {
        maxContextTokens: 8192,
        replyMaxTokens: 600,
        trimStrategy: 'trim_middle',
      },
      lorebook: null,
      scenario: null,
      settings: {
        defaultSystemPromptTemplate: 'DEFAULT_PROMPT',
        knownDefaultSystemPromptTemplates: ['DEFAULT_PROMPT'],
        responseLanguage: 'ru',
        systemPromptTemplate: null,
        thinkingEnabled: true,
      },
    });
  });

  it('preserves chat overrides and optional character, scenario, and lorebook snapshots', () => {
    const snapshot = buildPromptInputSnapshot({
      character: {
        description: 'Частный детектив.',
        mesExample: '<START>\n{{char}}: Тише.',
        name: 'Морган',
        personality: 'Сдержанный',
        systemPrompt: '{{char}} не доверяет {{user}}.',
      },
      chat: {
        customSystemPrompt: '',
        customUserName: 'Алекс',
        customUserPersona: 'Свидетель',
        id: 'chat-2',
        title: 'Ночной допрос',
        transcript: [
          {
            content: 'Кто вы?',
            id: 'm2',
            role: 'assistant',
          },
        ],
      },
      generation: {
        maxContextTokens: 16384,
        replyMaxTokens: 900,
        trimStrategy: 'trim_start',
      },
      lorebook: {
        entries: [
          {
            content: 'Подвал пахнет сыростью.',
            id: 'entry-1',
            isEnabled: true,
            keywords: ['подвал', 'сырость'],
            order: 10,
          },
        ],
      },
      scenario: {
        content: '{{user}} приходит на ночной допрос к {{char}}.',
        name: 'Допрос',
      },
      settings: {
        defaultSystemPromptTemplate: 'DEFAULT_PROMPT',
        knownDefaultSystemPromptTemplates: ['DEFAULT_PROMPT', 'LEGACY_PROMPT'],
        responseLanguage: 'ru',
        systemPromptTemplate: 'CUSTOM_PROMPT',
        thinkingEnabled: false,
      },
    });

    expect(snapshot).toEqual({
      character: {
        description: 'Частный детектив.',
        mesExample: '<START>\n{{char}}: Тише.',
        name: 'Морган',
        personality: 'Сдержанный',
        systemPrompt: '{{char}} не доверяет {{user}}.',
      },
      chat: {
        customSystemPrompt: '',
        customUserName: 'Алекс',
        customUserPersona: 'Свидетель',
        id: 'chat-2',
        title: 'Ночной допрос',
        transcript: [
          {
            content: 'Кто вы?',
            id: 'm2',
            role: 'assistant',
          },
        ],
      },
      generation: {
        maxContextTokens: 16384,
        replyMaxTokens: 900,
        trimStrategy: 'trim_start',
      },
      lorebook: {
        entries: [
          {
            content: 'Подвал пахнет сыростью.',
            id: 'entry-1',
            isEnabled: true,
            keywords: ['подвал', 'сырость'],
            order: 10,
          },
        ],
      },
      scenario: {
        content: '{{user}} приходит на ночной допрос к {{char}}.',
        name: 'Допрос',
      },
      settings: {
        defaultSystemPromptTemplate: 'DEFAULT_PROMPT',
        knownDefaultSystemPromptTemplates: ['DEFAULT_PROMPT', 'LEGACY_PROMPT'],
        responseLanguage: 'ru',
        systemPromptTemplate: 'CUSTOM_PROMPT',
        thinkingEnabled: false,
      },
    });
  });

  it('freezes the snapshot graph to keep it immutable after construction', () => {
    const snapshot = buildPromptInputSnapshot({
      chat: {
        id: 'chat-3',
      },
      generation: {
        maxContextTokens: 4096,
        replyMaxTokens: 400,
        trimStrategy: 'trim_middle',
      },
      settings: {
        defaultSystemPromptTemplate: 'DEFAULT_PROMPT',
        responseLanguage: 'en',
        thinkingEnabled: true,
      },
    });

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.chat)).toBe(true);
    expect(Object.isFrozen(snapshot.chat.transcript)).toBe(true);
    expect(Object.isFrozen(snapshot.settings)).toBe(true);
    expect(Object.isFrozen(snapshot.generation)).toBe(true);
  });
});
