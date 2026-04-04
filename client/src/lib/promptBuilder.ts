// ── System prompt builder ────────────────────────────────────────────────────

import { DEFAULT_PROMPTS, getDefaultSystemPrompt, useAppStore } from '@/stores';
import type { Character, Scenario } from '@/types';

interface UserOverrides {
  userName?: string;
  userPersona?: string;
}

/** Compute the "core" system prompt (no World Info, no language enforcement).
 *  Used by both buildChatData and the SystemPromptSection preview. */
export function computeBaseSystemPrompt(
  character: Character,
  sessionOverrides?: Partial<Character>,
  activeScenario?: Scenario | null,
  userOverrides?: UserOverrides,
): string {
  const {
    userPersona: globalPersona,
    userName: globalName,
    systemPromptTemplate,
    responseLanguage,
  } = useAppStore.getState();

  const effectiveName = userOverrides?.userName ?? globalName;
  const effectivePersona = userOverrides?.userPersona ?? globalPersona;
  const ch = sessionOverrides ? { ...character, ...sessionOverrides } : character;

  // Free chat (no character) — no system prompt by default
  const isFreeChat = !ch.name && !ch.description;
  if (isFreeChat && !ch.system_prompt) {
    return '';
  }

  let text: string;
  if (ch.system_prompt) {
    text = ch.system_prompt.replace(/\{\{char\}\}/g, ch.name).replace(/\{\{user\}\}/g, effectiveName || 'User');
  } else {
    // Use language-appropriate default if the template hasn't been customized
    const template = DEFAULT_PROMPTS.includes(systemPromptTemplate)
      ? getDefaultSystemPrompt(responseLanguage)
      : systemPromptTemplate;
    // Replace {{char}}/{{user}} in scenario content before inserting into template
    const scenarioContent = (activeScenario?.content || '')
      .replace(/\{\{char\}\}/g, ch.name)
      .replace(/\{\{user\}\}/g, effectiveName || 'User');

    text = template
      .replace(/\{\{char\}\}/g, ch.name)
      .replace(/\{\{user\}\}/g, effectiveName || 'User')
      .replace(/\{\{description\}\}/g, ch.description || '')
      .replace(/\{\{personality\}\}/g, ch.personality || '')
      .replace(/\{\{scenario\}\}/g, scenarioContent)
      .replace(/\{\{userPersona\}\}/g, effectivePersona || '');

    text = text.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName: string, content: string) => {
      const vars: Record<string, string | undefined> = {
        personality: ch.personality,
        scenario: activeScenario?.content,
        userPersona: effectivePersona,
      };
      return vars[varName] ? content : '';
    });
  }
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
