import { describe, expect, it } from 'vitest';

import { resolvePromptTemplateSource } from './application/prompt-source.js';

const currentDefaultPrompt = 'CURRENT_DEFAULT_PROMPT';
const legacyDefaultPromptEn = 'LEGACY_DEFAULT_PROMPT_EN';
const legacyDefaultPromptRu = 'LEGACY_DEFAULT_PROMPT_RU';

describe('prompt template source precedence', () => {
  it('prefers chat overrides over every lower-priority source', () => {
    const result = resolvePromptTemplateSource({
      chatSystemPrompt: 'chat override',
      characterSystemPrompt: 'character override',
      defaultSystemPromptTemplate: currentDefaultPrompt,
      knownDefaultSystemPromptTemplates: [legacyDefaultPromptEn, legacyDefaultPromptRu, currentDefaultPrompt],
      settingsSystemPromptTemplate: 'settings template',
    });

    expect(result).toEqual({
      kind: 'chat-override',
      template: 'chat override',
    });
  });

  it('treats an empty chat override as an explicit override', () => {
    const result = resolvePromptTemplateSource({
      chatSystemPrompt: '',
      characterSystemPrompt: 'character override',
      defaultSystemPromptTemplate: currentDefaultPrompt,
      settingsSystemPromptTemplate: 'settings template',
    });

    expect(result).toEqual({
      kind: 'chat-override',
      template: '',
    });
  });

  it('uses character overrides when chat overrides are absent', () => {
    const result = resolvePromptTemplateSource({
      characterSystemPrompt: '{{char}} watches {{user}} closely.',
      defaultSystemPromptTemplate: currentDefaultPrompt,
      settingsSystemPromptTemplate: 'settings template',
    });

    expect(result).toEqual({
      kind: 'character-override',
      template: '{{char}} watches {{user}} closely.',
    });
  });

  it('does not treat an empty character override as authoritative', () => {
    const result = resolvePromptTemplateSource({
      characterSystemPrompt: '',
      defaultSystemPromptTemplate: currentDefaultPrompt,
      settingsSystemPromptTemplate: 'settings template',
    });

    expect(result).toEqual({
      kind: 'settings-template',
      template: 'settings template',
    });
  });

  it('uses the built-in default when the settings template is missing', () => {
    const result = resolvePromptTemplateSource({
      defaultSystemPromptTemplate: currentDefaultPrompt,
    });

    expect(result).toEqual({
      kind: 'default-template',
      template: currentDefaultPrompt,
    });
  });

  it('uses the built-in default when the settings template still matches a known default', () => {
    const result = resolvePromptTemplateSource({
      defaultSystemPromptTemplate: currentDefaultPrompt,
      knownDefaultSystemPromptTemplates: [legacyDefaultPromptEn, legacyDefaultPromptRu, currentDefaultPrompt],
      settingsSystemPromptTemplate: legacyDefaultPromptEn,
    });

    expect(result).toEqual({
      kind: 'default-template',
      template: currentDefaultPrompt,
    });
  });

  it('uses the customized settings template when it is not a known default', () => {
    const result = resolvePromptTemplateSource({
      defaultSystemPromptTemplate: currentDefaultPrompt,
      knownDefaultSystemPromptTemplates: [legacyDefaultPromptEn, legacyDefaultPromptRu, currentDefaultPrompt],
      settingsSystemPromptTemplate: 'custom settings template',
    });

    expect(result).toEqual({
      kind: 'settings-template',
      template: 'custom settings template',
    });
  });

  it('allows an empty custom settings template', () => {
    const result = resolvePromptTemplateSource({
      defaultSystemPromptTemplate: currentDefaultPrompt,
      knownDefaultSystemPromptTemplates: [legacyDefaultPromptEn, legacyDefaultPromptRu, currentDefaultPrompt],
      settingsSystemPromptTemplate: '',
    });

    expect(result).toEqual({
      kind: 'settings-template',
      template: '',
    });
  });
});
