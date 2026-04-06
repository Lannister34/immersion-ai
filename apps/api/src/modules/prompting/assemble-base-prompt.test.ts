import { describe, expect, it } from 'vitest';

import { assembleBasePrompt } from './application/assemble-base-prompt.js';
import { buildPromptInputSnapshot } from './application/prompt-input-snapshot.js';
import { PromptTemplateParseError } from './application/prompt-template-engine.js';

describe('assemble base prompt', () => {
  it('prefers chat overrides and returns the normalized assembled prompt', () => {
    const snapshot = buildPromptInputSnapshot({
      character: {
        description: 'Private detective.',
        mesExample: null,
        name: 'Morgan',
        personality: 'Reserved',
        systemPrompt: '{{char}} is wary of {{user}}.',
      },
      chat: {
        customSystemPrompt: '  {{char}} watches {{user}}.\n\n\n{{#if userPersona}}Persona: {{userPersona}}{{/if}}  ',
        customUserPersona: 'Witness',
        id: 'chat-1',
      },
      generation: {
        maxContextTokens: 8192,
        replyMaxTokens: 600,
        trimStrategy: 'trim_middle',
      },
      settings: {
        defaultSystemPromptTemplate: 'DEFAULT_PROMPT',
        knownDefaultSystemPromptTemplates: ['DEFAULT_PROMPT'],
        responseLanguage: 'ru',
        systemPromptTemplate: 'SETTINGS_PROMPT',
        thinkingEnabled: true,
      },
      user: {
        name: 'Alex',
        persona: 'Negotiator',
      },
    });

    const result = assembleBasePrompt(snapshot);

    expect(result).toEqual({
      diagnostics: {
        cyclicVariables: [],
        invalidVariableTemplates: [],
        unknownConditions: [],
        unresolvedVariables: [],
      },
      prompt: 'Morgan watches Alex.\n\nPersona: Witness',
      source: {
        kind: 'chat-override',
        template: '  {{char}} watches {{user}}.\n\n\n{{#if userPersona}}Persona: {{userPersona}}{{/if}}  ',
      },
      variableValues: {
        'character.description': 'Private detective.',
        'character.name': 'Morgan',
        'character.personality': 'Reserved',
        'scenario.content': null,
        'user.name': 'Alex',
        'user.persona': 'Witness',
      },
    });
  });

  it('uses the built-in default template when settings still point at a known default', () => {
    const snapshot = buildPromptInputSnapshot({
      character: {
        description: 'Private detective.',
        mesExample: null,
        name: 'Morgan',
        personality: 'Reserved',
        systemPrompt: null,
      },
      chat: {
        id: 'chat-2',
      },
      generation: {
        maxContextTokens: 8192,
        replyMaxTokens: 600,
        trimStrategy: 'trim_middle',
      },
      settings: {
        defaultSystemPromptTemplate: 'Hello {{char}} and {{user}}.',
        knownDefaultSystemPromptTemplates: ['Hello {{char}} and {{user}}.', 'LEGACY_PROMPT'],
        responseLanguage: 'en',
        systemPromptTemplate: 'LEGACY_PROMPT',
        thinkingEnabled: true,
      },
      user: {
        name: 'Alex',
      },
    });

    const result = assembleBasePrompt(snapshot);

    expect(result.source).toEqual({
      kind: 'default-template',
      template: 'Hello {{char}} and {{user}}.',
    });
    expect(result.prompt).toBe('Hello Morgan and Alex.');
  });

  it('preserves renderer diagnostics for unresolved variables', () => {
    const snapshot = buildPromptInputSnapshot({
      chat: {
        id: 'chat-3',
      },
      generation: {
        maxContextTokens: 8192,
        replyMaxTokens: 600,
        trimStrategy: 'trim_middle',
      },
      settings: {
        defaultSystemPromptTemplate: 'Hello {{future.variable}} and {{user}}.',
        responseLanguage: 'en',
        thinkingEnabled: true,
      },
      user: {
        name: 'Alex',
      },
    });

    const result = assembleBasePrompt(snapshot);

    expect(result.prompt).toBe('Hello {{future.variable}} and Alex.');
    expect(result.diagnostics.unresolvedVariables).toEqual(['future.variable']);
  });

  it('throws when the selected template is structurally invalid', () => {
    const snapshot = buildPromptInputSnapshot({
      chat: {
        customSystemPrompt: '{{#if user}}broken',
        id: 'chat-4',
      },
      generation: {
        maxContextTokens: 8192,
        replyMaxTokens: 600,
        trimStrategy: 'trim_middle',
      },
      settings: {
        defaultSystemPromptTemplate: 'DEFAULT_PROMPT',
        responseLanguage: 'en',
        thinkingEnabled: true,
      },
      user: {
        name: 'Alex',
      },
    });

    expect(() => assembleBasePrompt(snapshot)).toThrowError(PromptTemplateParseError);
  });

  it('freezes the assembled result graph', () => {
    const snapshot = buildPromptInputSnapshot({
      chat: {
        id: 'chat-5',
      },
      generation: {
        maxContextTokens: 8192,
        replyMaxTokens: 600,
        trimStrategy: 'trim_middle',
      },
      settings: {
        defaultSystemPromptTemplate: 'Hello {{user}}.',
        responseLanguage: 'en',
        thinkingEnabled: true,
      },
      user: {
        name: 'Alex',
      },
    });

    const result = assembleBasePrompt(snapshot);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.source)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(Object.isFrozen(result.diagnostics.unresolvedVariables)).toBe(true);
  });
});
