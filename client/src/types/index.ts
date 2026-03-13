export interface Character {
  name: string;
  description: string;
  personality: string;
  mes_example: string;
  tags: string[];
  avatar?: string; // filename like "Arina.png"
  world?: string;  // lorebook name
  system_prompt?: string; // character-specific system prompt override
}

export interface WorldInfoEntry {
  uid: number;
  key: string[];
  keysecondary: string[];
  comment: string;
  content: string;
  constant: boolean;
  selective: boolean;
  order: number;
  position: number;
  disable: boolean;
  displayIndex: number;
  addMemo: boolean;
  group: string;
  groupOverride: boolean;
  groupWeight: number;
  sticky: number;
  cooldown: number;
  delay: number;
  probability: number;
  depth: number;
  useProbability: boolean;
  role: string | null;
}

export interface WorldInfo {
  name: string;
  entries: Record<string, WorldInfoEntry>;
}

export interface Scenario {
  name: string;
  content: string;
  tags: string[];
  concept?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioSummary {
  name: string;
  content?: string;
  tags: string[];
  updatedAt: string | null;
}

export type ContextTrimStrategy = 'trim_start' | 'trim_middle';

export interface SamplerSettings {
  temperature: number;
  top_p: number;
  top_k: number;
  min_p: number;
  rep_pen: number;
  rep_pen_range: number;
  presence_penalty: number;
  max_length: number;
  max_context_length: number;
  context_trim_strategy: ContextTrimStrategy;
}

export interface SamplerPreset extends SamplerSettings {
  id: string;
  name: string;
}

export interface ConnectionStatus {
  connected: boolean;
  model?: string;
  url?: string;
}

export type Page = 'characters' | 'lorebooks' | 'scenarios' | 'settings' | 'chat';

/** Persisted metadata about a chat session for listing/filtering */
export interface ChatSessionMeta {
  /** Character avatar filename (unique key for the character) */
  characterAvatar: string;
  /** Character display name at the time the chat was created */
  characterName: string;
  /** Chat ID (timestamp, used as file name on disk) */
  chatFile: string;
  /** Model used during the chat (captured from connection status) */
  model?: string;
  /** ISO string when the chat was first opened in our UI */
  createdAt: string;
  /** ISO string of last activity */
  lastActiveAt: string;
  /** Number of messages at last save */
  messageCount?: number;
  /** Preview of the last message */
  lastMessagePreview?: string;
  /** Auto-generated or user-edited chat title (e.g. "Встреча в библиотеке") */
  title?: string;
  /** Per-chat sampler overrides merged on top of the effective preset */
  customSamplerSettings?: Partial<SamplerSettings>;
  /** Per-chat character field overrides (description, personality set at chat start) */
  characterOverrides?: Partial<Character>;
  /** Name of the attached standalone scenario (from /scenarios page) */
  activeScenarioName?: string;
  /** Per-chat system prompt override; replaces the computed template (WI + language still appended) */
  customSystemPrompt?: string | null;
}

export interface GeneratedCharacter {
  name: string;
  description: string;
  personality: string;
  mes_example: string;
  tags: string[];
}

export interface GeneratedLorebook {
  entries: Array<{
    key: string[];
    comment: string;
    content: string;
  }>;
}
