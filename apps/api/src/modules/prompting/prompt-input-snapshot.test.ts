import { describe, expect, it } from 'vitest';

import { buildPromptInputSnapshot } from './application/prompt-input-snapshot.js';

describe('prompt input snapshot', () => {
  it('normalizes optional fields, preserves user data, and clones mutable inputs', () => {
    const transcript = [
      {
        content: 'Hello.',
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
      user: {
        name: 'Alex',
        persona: 'Detective',
      },
    });

    transcript[0]!.content = 'Mutated';
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
            content: 'Hello.',
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
      user: {
        name: 'Alex',
        persona: 'Detective',
      },
    });
  });

  it('preserves overrides and optional character, scenario, lorebook, and user snapshots', () => {
    const snapshot = buildPromptInputSnapshot({
      character: {
        description: 'Private detective.',
        mesExample: '<START>\n{{char}}: Quiet.',
        name: 'Morgan',
        personality: 'Reserved',
        systemPrompt: '{{char}} does not trust {{user}}.',
      },
      chat: {
        customSystemPrompt: '',
        customUserName: 'Alex',
        customUserPersona: 'Witness',
        id: 'chat-2',
        title: 'Night Interrogation',
        transcript: [
          {
            content: 'Who are you?',
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
            content: 'The basement smells damp.',
            id: 'entry-1',
            isEnabled: true,
            keywords: ['basement', 'damp'],
            order: 10,
          },
        ],
      },
      scenario: {
        content: '{{user}} arrives for a late-night interrogation with {{char}}.',
        name: 'Interrogation',
      },
      settings: {
        defaultSystemPromptTemplate: 'DEFAULT_PROMPT',
        knownDefaultSystemPromptTemplates: ['DEFAULT_PROMPT', 'LEGACY_PROMPT'],
        responseLanguage: 'ru',
        systemPromptTemplate: 'CUSTOM_PROMPT',
        thinkingEnabled: false,
      },
      user: {
        name: 'Global Alex',
        persona: 'Negotiator',
      },
    });

    expect(snapshot).toEqual({
      character: {
        description: 'Private detective.',
        mesExample: '<START>\n{{char}}: Quiet.',
        name: 'Morgan',
        personality: 'Reserved',
        systemPrompt: '{{char}} does not trust {{user}}.',
      },
      chat: {
        customSystemPrompt: '',
        customUserName: 'Alex',
        customUserPersona: 'Witness',
        id: 'chat-2',
        title: 'Night Interrogation',
        transcript: [
          {
            content: 'Who are you?',
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
            content: 'The basement smells damp.',
            id: 'entry-1',
            isEnabled: true,
            keywords: ['basement', 'damp'],
            order: 10,
          },
        ],
      },
      scenario: {
        content: '{{user}} arrives for a late-night interrogation with {{char}}.',
        name: 'Interrogation',
      },
      settings: {
        defaultSystemPromptTemplate: 'DEFAULT_PROMPT',
        knownDefaultSystemPromptTemplates: ['DEFAULT_PROMPT', 'LEGACY_PROMPT'],
        responseLanguage: 'ru',
        systemPromptTemplate: 'CUSTOM_PROMPT',
        thinkingEnabled: false,
      },
      user: {
        name: 'Global Alex',
        persona: 'Negotiator',
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
      user: {
        name: 'User',
      },
    });

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.chat)).toBe(true);
    expect(Object.isFrozen(snapshot.chat.transcript)).toBe(true);
    expect(Object.isFrozen(snapshot.settings)).toBe(true);
    expect(Object.isFrozen(snapshot.generation)).toBe(true);
    expect(Object.isFrozen(snapshot.user)).toBe(true);
  });
});
