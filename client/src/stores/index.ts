import { create } from 'zustand';
import { getUserSettings, saveUserSettings } from '@/api';
import type { UiLanguage } from '@/i18n';
import type { ChatSessionMeta, ConnectionStatus, ProviderConfig, SamplerPreset, SamplerSettings } from '@/types';
import { ProviderType } from '@/types';

interface AppState {
  connection: ConnectionStatus;
  setConnection: (status: ConnectionStatus) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  userName: string;
  setUserName: (name: string) => void;

  userPersona: string;
  setUserPersona: (persona: string) => void;

  // Sampler presets
  samplerPresets: SamplerPreset[];
  activePresetId: string;
  modelPresetMap: Record<string, string>; // modelName → presetId

  addPreset: (preset: SamplerPreset) => void;
  updatePreset: (id: string, partial: Partial<SamplerSettings>) => void;
  renamePreset: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  setActivePreset: (id: string) => void;
  setModelPreset: (model: string, presetId: string | null) => void;

  systemPromptTemplate: string;
  setSystemPromptTemplate: (template: string) => void;

  uiLanguage: UiLanguage;
  setUiLanguage: (lang: UiLanguage) => void;

  responseLanguage: 'ru' | 'en' | 'none';
  setResponseLanguage: (lang: 'ru' | 'en' | 'none') => void;

  streamingEnabled: boolean;
  setStreamingEnabled: (enabled: boolean) => void;

  thinkingEnabled: boolean;
  setThinkingEnabled: (enabled: boolean) => void;

  /** Persisted chat session metadata for the chat list */
  chatSessions: ChatSessionMeta[];
  upsertChatSession: (meta: ChatSessionMeta) => void;
  removeChatSession: (characterAvatar: string, chatFile: string) => void;
  getChatSession: (characterAvatar: string, chatFile: string) => ChatSessionMeta | undefined;

  // Provider connection config (external providers)
  activeProvider: ProviderType;
  providerConfigs: Record<string, ProviderConfig>;
  setActiveProvider: (provider: ProviderType) => void;
  updateProviderConfig: (provider: ProviderType, partial: Partial<ProviderConfig>) => void;

  // LLM Server management
  backendMode: 'builtin' | 'external';
  setBackendMode: (mode: 'builtin' | 'external') => void;

  llmServerConfig: LlmServerConfig;
  setLlmServerConfig: (partial: Partial<LlmServerConfig>) => void;

  // Transient (not persisted)
  llmServerStatus: 'idle' | 'starting' | 'running' | 'stopping' | 'error';
  setLlmServerStatus: (status: 'idle' | 'starting' | 'running' | 'stopping' | 'error') => void;

  /** Server sync state */
  _serverSynced: boolean;
}

export interface LlmServerConfig {
  modelsDirs: string[];
  port: number;
  gpuLayers: number;
  contextSize: number;
  flashAttention: boolean;
  threads: number;
}

const DEFAULT_LLM_SERVER_CONFIG: LlmServerConfig = {
  modelsDirs: [], // Will be set from server's defaultModelsDir on first load
  port: 5001,
  gpuLayers: 999,
  contextSize: 8192,
  flashAttention: true,
  threads: 0,
};

const DEFAULT_PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  [ProviderType.KoboldCpp]: { url: 'http://127.0.0.1:5001' },
};

const DEFAULT_SAMPLER_SETTINGS: SamplerSettings = {
  temperature: 1.0,
  top_p: 1,
  top_k: 0,
  min_p: 0.02,
  rep_pen: 1.05,
  rep_pen_range: 2048,
  presence_penalty: 0,
  max_length: 600,
  max_context_length: 8192,
  context_trim_strategy: 'trim_middle',
};

const MISTRAL_TEKKEN_PRESET: SamplerPreset = {
  id: 'mistral-v7-tekken',
  name: 'Mistral V7-Tekken',
  temperature: 0.7,
  top_p: 1,
  top_k: 0,
  min_p: 0.035,
  rep_pen: 1.07,
  rep_pen_range: 2048,
  presence_penalty: 0,
  max_length: 1024,
  max_context_length: 15872,
  context_trim_strategy: 'trim_middle',
};

const DEFAULT_PRESET: SamplerPreset = {
  id: 'default',
  name: 'Default',
  ...DEFAULT_SAMPLER_SETTINGS,
};

const DEFAULT_SYSTEM_PROMPT_EN = `Write {{char}}'s next reply in a collaborative roleplay between {{char}} and {{user}}.

{{char}}'s character card:
{{description}}
{{#if personality}}Personality: {{personality}}{{/if}}
{{#if scenario}}Scenario: {{scenario}}{{/if}}

{{#if userPersona}}[{{user}}'s persona: {{userPersona}}]{{/if}}

Guidelines:
- Write in third person; use *asterisks* for actions/narration, unformatted text for dialogue
- Match {{char}}'s vocabulary, speech patterns, and thinking to their age, background, and personality — avoid overly literary or elaborate language unless it fits the character
- Match reply length to the situation: short exchanges → 1-2 paragraphs, pivotal scenes → up to 3-4
- Focus on what matters: emotions, key actions, meaningful dialogue. Cut filler and redundant descriptions
- Never speak or act as {{user}}; never narrate {{user}}'s thoughts or actions
- Advance the plot naturally; avoid repeating information already established
- Stay in character at all times`;

const DEFAULT_SYSTEM_PROMPT_RU = `Напиши следующую реплику {{char}} в совместной ролевой игре между {{char}} и {{user}}.

Карточка персонажа {{char}}:
{{description}}
{{#if personality}}Характер: {{personality}}{{/if}}
{{#if scenario}}Сценарий: {{scenario}}{{/if}}

{{#if userPersona}}[Персона {{user}}: {{userPersona}}]{{/if}}

Правила:
- Пиши от третьего лица; используй *звёздочки* для действий и повествования, обычный текст для диалогов
- Подбирай лексику, манеру речи и мышление {{char}} под возраст, происхождение и характер персонажа — избегай излишне литературного или вычурного языка, если это не соответствует персонажу
- Подбирай длину ответа по ситуации: короткие реплики → 1-2 абзаца, ключевые сцены → до 3-4
- Сосредоточься на важном: эмоции, ключевые действия, значимые диалоги. Убирай воду и лишние описания
- Никогда не говори и не действуй за {{user}}; не описывай мысли и действия {{user}}
- Развивай сюжет естественно; не повторяй уже установленную информацию
- Всегда оставайся в образе`;

/** Returns the default system prompt for the given language. */
function getDefaultSystemPrompt(lang: string): string {
  return lang === 'en' ? DEFAULT_SYSTEM_PROMPT_EN : DEFAULT_SYSTEM_PROMPT_RU;
}

/** All known default prompts (current + legacy, used to detect if the user has customized the template). */
const LEGACY_DEFAULT = `Write {{char}}'s next reply in a collaborative roleplay between {{char}} and {{user}}.

{{char}}'s character card:
{{description}}
{{#if personality}}Personality: {{personality}}{{/if}}
{{#if scenario}}Scenario: {{scenario}}{{/if}}

{{#if userPersona}}[{{user}}'s persona: {{userPersona}}]{{/if}}

Guidelines:
- Write in third person, using vivid and literary Russian language
- Use *asterisks* for actions/narration, unformatted text for dialogue
- Match reply length to the situation: short exchanges → 1-2 paragraphs, pivotal scenes → up to 3-4
- Focus on what matters: emotions, key actions, meaningful dialogue. Cut filler and redundant descriptions
- Never speak or act as {{user}}; never narrate {{user}}'s thoughts or actions
- Advance the plot naturally; avoid repeating information already established
- Stay in character at all times`;
const DEFAULT_PROMPTS = [DEFAULT_SYSTEM_PROMPT_EN, DEFAULT_SYSTEM_PROMPT_RU, LEGACY_DEFAULT];

// ── Fields persisted to server (user-settings.json) ────────────────────────

const PERSISTED_KEYS = [
  'userName',
  'userPersona',
  'samplerPresets',
  'activePresetId',
  'modelPresetMap',
  'systemPromptTemplate',
  'uiLanguage',
  'responseLanguage',
  'streamingEnabled',
  'thinkingEnabled',
  'chatSessions',
  'backendMode',
  'llmServerConfig',
  'activeProvider',
  'providerConfigs',
] as const;

type PersistedKey = (typeof PERSISTED_KEYS)[number];

function extractPersisted(state: AppState): Record<PersistedKey, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of PERSISTED_KEYS) {
    result[key] = state[key];
  }
  return result as Record<PersistedKey, unknown>;
}

// ── Debounced server sync ──────────────────────────────────────────────────

let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSyncToServer() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const state = useAppStore.getState();
    const data = extractPersisted(state);
    saveUserSettings(data).catch((err) => console.warn('Failed to sync settings to server:', err));
  }, 1000); // debounce 1s
}

/**
 * Immediately sync current settings to server (bypass debounce).
 * Call after explicit user save actions like "Сохранить" button.
 */
export async function syncToServerNow(): Promise<void> {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  const state = useAppStore.getState();
  const data = extractPersisted(state);
  await saveUserSettings(data);
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve the base preset (model preset → global active preset).
 */
export function getBasePreset(state: AppState): SamplerPreset {
  const findPreset = (id: string) => state.samplerPresets.find((p) => p.id === id);

  // 1. Model-specific preset
  if (state.connection.connected && state.connection.model) {
    const modelPresetId = state.modelPresetMap[state.connection.model];
    if (modelPresetId) {
      const preset = findPreset(modelPresetId);
      if (preset) return preset;
    }
  }

  // 2. Global active preset
  return findPreset(state.activePresetId) ?? DEFAULT_PRESET;
}

/**
 * Resolve the effective sampler settings for a given context.
 * Priority: per-chat overrides → model preset → global active preset.
 */
export function getEffectiveSamplerSettings(state: AppState, chatFile?: string): SamplerSettings {
  const base = getBasePreset(state);

  // Merge chat-level overrides on top
  if (chatFile) {
    const session = state.chatSessions.find((s) => s.chatFile === chatFile);
    if (session?.customSamplerSettings) {
      return { ...base, ...session.customSamplerSettings };
    }
  }

  return base;
}

/**
 * Resolve the active provider's connection config.
 */
export function getActiveProviderConfig(state: AppState): ProviderConfig {
  return state.providerConfigs[state.activeProvider] ?? DEFAULT_PROVIDER_CONFIGS[ProviderType.KoboldCpp];
}

/**
 * Resolve the active connection URL (shortcut).
 */
export function getActiveConnectionUrl(state: AppState): string {
  return getActiveProviderConfig(state).url;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()((set, get) => ({
  connection: { connected: false },
  setConnection: (connection) => set({ connection }),

  // Default collapsed on mobile (< 768px)
  sidebarCollapsed: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  userName: 'User',
  setUserName: (name) => set({ userName: name }),

  userPersona: '',
  setUserPersona: (persona) => set({ userPersona: persona }),

  // Sampler presets
  samplerPresets: [DEFAULT_PRESET, MISTRAL_TEKKEN_PRESET],
  activePresetId: 'default',
  modelPresetMap: {},

  addPreset: (preset) => set((s) => ({ samplerPresets: [...s.samplerPresets, preset] })),

  updatePreset: (id, partial) =>
    set((s) => ({
      samplerPresets: s.samplerPresets.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    })),

  renamePreset: (id, name) =>
    set((s) => ({
      samplerPresets: s.samplerPresets.map((p) => (p.id === id ? { ...p, name } : p)),
    })),

  deletePreset: (id) =>
    set((s) => {
      if (s.samplerPresets.length <= 1) return s; // keep at least one
      const filtered = s.samplerPresets.filter((p) => p.id !== id);
      const newActive = s.activePresetId === id ? filtered[0].id : s.activePresetId;
      // Clean up model mappings pointing to deleted preset
      const newMap = { ...s.modelPresetMap };
      for (const [model, pid] of Object.entries(newMap)) {
        if (pid === id) delete newMap[model];
      }
      return {
        samplerPresets: filtered,
        activePresetId: newActive,
        modelPresetMap: newMap,
      };
    }),

  setActivePreset: (id) => set({ activePresetId: id }),

  setModelPreset: (model, presetId) =>
    set((s) => {
      const newMap = { ...s.modelPresetMap };
      if (presetId) {
        newMap[model] = presetId;
      } else {
        delete newMap[model];
      }
      return { modelPresetMap: newMap };
    }),

  systemPromptTemplate: DEFAULT_SYSTEM_PROMPT_RU,
  setSystemPromptTemplate: (template) => set({ systemPromptTemplate: template }),

  uiLanguage: 'ru',
  setUiLanguage: (lang) => {
    set({ uiLanguage: lang });
    // i18n.changeLanguage is called in App.tsx via subscription
  },

  responseLanguage: 'ru',
  setResponseLanguage: (lang) => {
    const state = get();
    const update: Partial<AppState> = { responseLanguage: lang };
    // Auto-swap system prompt template when it's still one of the defaults
    if (DEFAULT_PROMPTS.includes(state.systemPromptTemplate)) {
      update.systemPromptTemplate = getDefaultSystemPrompt(lang);
    }
    set(update);
  },

  streamingEnabled: true,
  setStreamingEnabled: (enabled) => set({ streamingEnabled: enabled }),

  thinkingEnabled: true,
  setThinkingEnabled: (enabled) => set({ thinkingEnabled: enabled }),

  // Chat sessions
  chatSessions: [],
  upsertChatSession: (meta) =>
    set((s) => {
      const existing = s.chatSessions.findIndex(
        (c) => c.characterAvatar === meta.characterAvatar && c.chatFile === meta.chatFile,
      );
      const sessions = [...s.chatSessions];
      if (existing >= 0) {
        // Filter out undefined values so they don't overwrite existing data (e.g. title)
        const cleaned = Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined));
        sessions[existing] = { ...sessions[existing], ...cleaned };
      } else {
        sessions.push(meta);
      }
      return { chatSessions: sessions };
    }),
  removeChatSession: (characterAvatar, chatFile) =>
    set((s) => ({
      chatSessions: s.chatSessions.filter((c) => !(c.characterAvatar === characterAvatar && c.chatFile === chatFile)),
    })),
  getChatSession: (characterAvatar, chatFile) =>
    get().chatSessions.find((c) => c.characterAvatar === characterAvatar && c.chatFile === chatFile),

  // Provider connection config
  activeProvider: ProviderType.KoboldCpp,
  providerConfigs: { ...DEFAULT_PROVIDER_CONFIGS },

  setActiveProvider: (provider) => set({ activeProvider: provider }),

  updateProviderConfig: (provider, partial) =>
    set((s) => ({
      providerConfigs: {
        ...s.providerConfigs,
        [provider]: { ...(s.providerConfigs[provider] ?? { url: '' }), ...partial },
      },
    })),

  // LLM Server
  backendMode: 'builtin',
  setBackendMode: (mode) => set({ backendMode: mode }),

  llmServerConfig: { ...DEFAULT_LLM_SERVER_CONFIG },
  setLlmServerConfig: (partial) => set((s) => ({ llmServerConfig: { ...s.llmServerConfig, ...partial } })),

  llmServerStatus: 'idle',
  setLlmServerStatus: (status) => set({ llmServerStatus: status }),

  _serverSynced: false,
}));

// ── Server sync: subscribe to state changes ────────────────────────────────

useAppStore.subscribe((state, prevState) => {
  // Don't sync until initial server load is complete
  if (!state._serverSynced) return;

  // Check if any persisted field actually changed
  const changed = PERSISTED_KEYS.some((key) => state[key] !== prevState[key]);
  if (changed) {
    scheduleSyncToServer();
  }
});

// ── Server sync: load on startup ───────────────────────────────────────────

/**
 * Fetch settings from server and merge into store.
 * Server is the sole source of truth for user settings.
 * Call this once on app startup.
 */
export async function initSettingsFromServer(): Promise<void> {
  // Clean up legacy localStorage data (persist middleware removed)
  localStorage.removeItem('st-ui-settings');

  try {
    const serverData = await getUserSettings();
    if (serverData && typeof serverData === 'object') {
      // Clean up stale llmServerConfig fields from server (legacy)
      const serverCfg = serverData.llmServerConfig as Record<string, unknown> | undefined;
      if (serverCfg) {
        delete serverCfg.executablePath;

        // Migrate legacy modelsDir (string) → modelsDirs (string[])
        if (typeof serverCfg.modelsDir === 'string') {
          const dir = serverCfg.modelsDir as string;
          if (!serverCfg.modelsDirs) {
            serverCfg.modelsDirs = dir && dir !== 'D:\\Neuro\\llm' ? [dir] : [];
          }
          delete serverCfg.modelsDir;
        }
      }

      // Migrate legacy connectionPresets → activeProvider + providerConfigs
      if ('connectionPresets' in serverData && !('providerConfigs' in serverData)) {
        const presets = serverData.connectionPresets as Array<{
          provider?: string;
          url?: string;
          apiKey?: string;
          id?: string;
        }>;
        const activeId = serverData.activeConnectionPresetId as string | undefined;
        const active = presets?.find((p) => p.id === activeId) ?? presets?.[0];
        if (active?.url) {
          serverData.activeProvider = active.provider ?? ProviderType.KoboldCpp;
          serverData.providerConfigs = {
            [active.provider ?? ProviderType.KoboldCpp]: { url: active.url, apiKey: active.apiKey },
          };
        }
        delete serverData.connectionPresets;
        delete serverData.activeConnectionPresetId;
      }

      // Apply only known persisted keys from server
      const patch: Record<string, unknown> = {};
      for (const key of PERSISTED_KEYS) {
        if (key in serverData && serverData[key] !== undefined) {
          patch[key] = serverData[key];
        }
      }
      if (Object.keys(patch).length > 0) {
        useAppStore.setState(patch);
      }
    } else {
      // No server data yet — push current defaults to server
      const data = extractPersisted(useAppStore.getState());
      saveUserSettings(data).catch(() => {});
    }
  } catch (err) {
    console.warn('Could not load settings from server, using defaults:', err);
  }
  // Mark as synced so future changes will be saved
  useAppStore.setState({ _serverSynced: true });
}

export type { SamplerSettings };
export {
  DEFAULT_PROMPTS,
  DEFAULT_PROVIDER_CONFIGS,
  DEFAULT_SAMPLER_SETTINGS,
  DEFAULT_SYSTEM_PROMPT_EN,
  DEFAULT_SYSTEM_PROMPT_RU,
  getDefaultSystemPrompt,
};
