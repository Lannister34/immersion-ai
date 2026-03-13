import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionStatus, ChatSessionMeta, SamplerSettings, SamplerPreset } from '@/types';
import { getUserSettings, saveUserSettings } from '@/api';

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
  modelsDir: string;
  port: number;
  gpuLayers: number;
  contextSize: number;
  flashAttention: boolean;
  threads: number;
}

const DEFAULT_LLM_SERVER_CONFIG: LlmServerConfig = {
  modelsDir: '',  // Will be set from server's defaultModelsDir on first load
  port: 5001,
  gpuLayers: 999,
  contextSize: 8192,
  flashAttention: true,
  threads: 0,
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

// ── Fields to persist (both localStorage and server) ───────────────────────

const PERSISTED_KEYS = [
  'userName', 'userPersona',
  'samplerPresets', 'activePresetId', 'modelPresetMap',
  'systemPromptTemplate', 'responseLanguage', 'streamingEnabled',
  'thinkingEnabled', 'chatSessions',
  'backendMode', 'llmServerConfig',
] as const;

type PersistedKey = typeof PERSISTED_KEYS[number];

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
    saveUserSettings(data).catch((err) =>
      console.warn('Failed to sync settings to server:', err),
    );
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

// ── Store ──────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      connection: { connected: false },
      setConnection: (connection) => set({ connection }),

      // Default collapsed on mobile (< 768px)
      sidebarCollapsed: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      userName: 'Алексей',
      setUserName: (name) => set({ userName: name }),

      userPersona: '',
      setUserPersona: (persona) => set({ userPersona: persona }),

      // Sampler presets
      samplerPresets: [DEFAULT_PRESET, MISTRAL_TEKKEN_PRESET],
      activePresetId: 'default',
      modelPresetMap: {},

      addPreset: (preset) =>
        set((s) => ({ samplerPresets: [...s.samplerPresets, preset] })),

      updatePreset: (id, partial) =>
        set((s) => ({
          samplerPresets: s.samplerPresets.map((p) =>
            p.id === id ? { ...p, ...partial } : p,
          ),
        })),

      renamePreset: (id, name) =>
        set((s) => ({
          samplerPresets: s.samplerPresets.map((p) =>
            p.id === id ? { ...p, name } : p,
          ),
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
            const cleaned = Object.fromEntries(
              Object.entries(meta).filter(([, v]) => v !== undefined),
            );
            sessions[existing] = { ...sessions[existing], ...cleaned };
          } else {
            sessions.push(meta);
          }
          return { chatSessions: sessions };
        }),
      removeChatSession: (characterAvatar, chatFile) =>
        set((s) => ({
          chatSessions: s.chatSessions.filter(
            (c) => !(c.characterAvatar === characterAvatar && c.chatFile === chatFile),
          ),
        })),
      getChatSession: (characterAvatar, chatFile) =>
        get().chatSessions.find(
          (c) => c.characterAvatar === characterAvatar && c.chatFile === chatFile,
        ),

      // LLM Server
      backendMode: 'builtin',
      setBackendMode: (mode) => set({ backendMode: mode }),

      llmServerConfig: { ...DEFAULT_LLM_SERVER_CONFIG },
      setLlmServerConfig: (partial) =>
        set((s) => ({ llmServerConfig: { ...s.llmServerConfig, ...partial } })),

      llmServerStatus: 'idle',
      setLlmServerStatus: (status) => set({ llmServerStatus: status }),

      _serverSynced: false,
    }),
    {
      name: 'st-ui-settings',
      version: 8,
      partialize: (state) => ({
        userName: state.userName,
        userPersona: state.userPersona,
        samplerPresets: state.samplerPresets,
        activePresetId: state.activePresetId,
        modelPresetMap: state.modelPresetMap,
        systemPromptTemplate: state.systemPromptTemplate,
        responseLanguage: state.responseLanguage,
        streamingEnabled: state.streamingEnabled,
        thinkingEnabled: state.thinkingEnabled,
        sidebarCollapsed: state.sidebarCollapsed,
        chatSessions: state.chatSessions,
        backendMode: state.backendMode,
        llmServerConfig: state.llmServerConfig,
      }),
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version < 1) {
          // v0→v1: Strip .jsonl from chatFile and deduplicate sessions
          const sessions = (state.chatSessions ?? []) as Array<Record<string, unknown>>;
          const cleaned = sessions.map((s) => ({
            ...s,
            chatFile: String(s.chatFile ?? '').replace(/\.jsonl$/i, ''),
          })) as Array<Record<string, unknown>>;
          const seen = new Map<string, Record<string, unknown>>();
          for (const s of cleaned) {
            const key = `${s.characterAvatar}::${s.chatFile}`;
            seen.set(key, s);
          }
          state.chatSessions = [...seen.values()];
        }
        if (version < 2) {
          // v1→v2: Migrate samplerSettings → presets system
          const oldSettings = state.samplerSettings as SamplerSettings | undefined;
          const defaultPreset: SamplerPreset = {
            id: 'default',
            name: 'Default',
            ...(oldSettings ?? DEFAULT_SAMPLER_SETTINGS),
          };
          state.samplerPresets = [defaultPreset];
          state.activePresetId = 'default';
          state.modelPresetMap = state.modelPresetMap ?? {};
          delete state.samplerSettings;
        }
        if (version < 3) {
          // v2→v3: Add Mistral V7-Tekken preset
          const presets = (state.samplerPresets ?? []) as SamplerPreset[];
          if (!presets.some((p) => p.id === 'mistral-v7-tekken')) {
            presets.push(MISTRAL_TEKKEN_PRESET);
            state.samplerPresets = presets;
          }
        }
        if (version < 4) {
          // v3→v4: Enable repetition penalty for Mistral preset
          const presets = (state.samplerPresets ?? []) as SamplerPreset[];
          const mistral = presets.find((p) => p.id === 'mistral-v7-tekken');
          if (mistral && mistral.rep_pen <= 1) {
            mistral.rep_pen = 1.07;
            mistral.rep_pen_range = 2048;
          }
          state.samplerPresets = presets;
        }
        if (version < 5) {
          // v4→v5: Add LLM server config
          state.backendMode = state.backendMode ?? 'builtin';
          state.llmServerConfig = state.llmServerConfig ?? { ...DEFAULT_LLM_SERVER_CONFIG };
        }
        if (version < 6) {
          // v5→v6: Remove executablePath from llmServerConfig (now auto-detected)
          const cfg = state.llmServerConfig as Record<string, unknown> | undefined;
          if (cfg) {
            delete cfg.executablePath;
            // Reset modelsDir if it was the old default — will be set from engine info
            if (cfg.modelsDir === 'D:\\Neuro\\llm') {
              cfg.modelsDir = '';
            }
          }
        }
        if (version < 7) {
          // v6→v7: Add context_trim_strategy to all presets
          const presets = (state.samplerPresets ?? []) as SamplerPreset[];
          for (const p of presets) {
            if (!p.context_trim_strategy) {
              p.context_trim_strategy = 'trim_start';
            }
          }
          state.samplerPresets = presets;
        }
        if (version < 8) {
          // v7→v8: activeScenarioName now available in ChatSessionMeta (no-op, optional field)
        }
        return state as ReturnType<typeof Object.assign>;
      },
    },
  ),
);

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
 * Server data takes priority over localStorage (it's the source of truth).
 * Call this once on app startup.
 */
export async function initSettingsFromServer(): Promise<void> {
  try {
    const serverData = await getUserSettings();
    if (serverData && typeof serverData === 'object') {
      // Clean up stale llmServerConfig from server (migration only runs on localStorage)
      const serverCfg = serverData.llmServerConfig as Record<string, unknown> | undefined;
      if (serverCfg) {
        delete serverCfg.executablePath;
        if (!serverCfg.modelsDir || serverCfg.modelsDir === 'D:\\Neuro\\llm') {
          serverCfg.modelsDir = '';
        }
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
      // No server data yet — push current local state to server
      const data = extractPersisted(useAppStore.getState());
      saveUserSettings(data).catch(() => {});
    }
  } catch (err) {
    console.warn('Could not load settings from server, using local:', err);
  }
  // Mark as synced so future changes will be saved
  useAppStore.setState({ _serverSynced: true });
}

export { DEFAULT_SYSTEM_PROMPT_EN, DEFAULT_SYSTEM_PROMPT_RU, getDefaultSystemPrompt, DEFAULT_PROMPTS, DEFAULT_SAMPLER_SETTINGS };
export type { SamplerSettings };
