// ── System prompt builder ────────────────────────────────────────────────────

import { DEFAULT_PROMPTS, getDefaultSystemPrompt, useAppStore } from '@/stores';
import type { Character, Scenario } from '@/types';

/** Compute the "core" system prompt (no World Info, no language enforcement).
 *  Used by both buildChatData and the SystemPromptSection preview. */
export function computeBaseSystemPrompt(
  character: Character,
  sessionOverrides?: Partial<Character>,
  activeScenario?: Scenario | null,
): string {
  const { userPersona, userName, systemPromptTemplate, responseLanguage } = useAppStore.getState();
  const ch = sessionOverrides ? { ...character, ...sessionOverrides } : character;

  let text: string;
  if (ch.system_prompt) {
    text = ch.system_prompt.replace(/\{\{char\}\}/g, ch.name).replace(/\{\{user\}\}/g, userName || 'User');
  } else {
    // Use language-appropriate default if the template hasn't been customized
    const template = DEFAULT_PROMPTS.includes(systemPromptTemplate)
      ? getDefaultSystemPrompt(responseLanguage)
      : systemPromptTemplate;
    text = template
      .replace(/\{\{char\}\}/g, ch.name)
      .replace(/\{\{user\}\}/g, userName || 'User')
      .replace(/\{\{description\}\}/g, ch.description || '')
      .replace(/\{\{personality\}\}/g, ch.personality || '')
      .replace(/\{\{scenario\}\}/g, activeScenario?.content || '')
      .replace(/\{\{userPersona\}\}/g, userPersona || '');

    text = text.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName: string, content: string) => {
      const vars: Record<string, string | undefined> = {
        personality: ch.personality,
        scenario: activeScenario?.content,
        userPersona,
      };
      return vars[varName] ? content : '';
    });
  }
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
