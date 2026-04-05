export type PromptTemplateSourceKind =
  | 'chat-override'
  | 'character-override'
  | 'settings-template'
  | 'default-template';

export interface ResolvePromptTemplateSourceInput {
  characterSystemPrompt?: string | null;
  chatSystemPrompt?: string | null;
  defaultSystemPromptTemplate: string;
  knownDefaultSystemPromptTemplates?: readonly string[];
  settingsSystemPromptTemplate?: string | null;
}

export interface PromptTemplateSourceSelection {
  kind: PromptTemplateSourceKind;
  template: string;
}

function isKnownDefaultTemplate(template: string, knownDefaults: readonly string[]): boolean {
  return knownDefaults.includes(template);
}

export function resolvePromptTemplateSource(input: ResolvePromptTemplateSourceInput): PromptTemplateSourceSelection {
  if (input.chatSystemPrompt != null) {
    return {
      kind: 'chat-override',
      template: input.chatSystemPrompt,
    };
  }

  if (input.characterSystemPrompt) {
    return {
      kind: 'character-override',
      template: input.characterSystemPrompt,
    };
  }

  if (input.settingsSystemPromptTemplate == null) {
    return {
      kind: 'default-template',
      template: input.defaultSystemPromptTemplate,
    };
  }

  const knownDefaultTemplates = input.knownDefaultSystemPromptTemplates ?? [];

  if (isKnownDefaultTemplate(input.settingsSystemPromptTemplate, knownDefaultTemplates)) {
    return {
      kind: 'default-template',
      template: input.defaultSystemPromptTemplate,
    };
  }

  return {
    kind: 'settings-template',
    template: input.settingsSystemPromptTemplate,
  };
}
