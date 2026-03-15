export interface Character {
  name: string;
  description: string;
  personality: string;
  mes_example: string;
  tags: string[];
  avatar?: string; // filename like "Arina.png"
  world?: string; // lorebook name
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

export interface ChatMessage {
  name: string;
  is_user: boolean;
  mes: string;
  send_date: string;
  extra?: Record<string, unknown>;
  is_system?: boolean;
}

export interface GeneratedCharacter {
  name: string;
  description: string;
  personality: string;
  mes_example: string;
  tags: string[];
}

export interface AvatarPrompt {
  positive: string;
  negative: string;
}

export interface GeneratedLorebook {
  entries: Array<{
    key: string[];
    comment: string;
    content: string;
  }>;
}

// ── Chat API Types ──────────────────────────────────────────────────────────

export interface ChatFileInfo {
  file_name: string;
  file_size: string;
  chat_items: number;
  mes: string;
  last_mes: string;
}

export interface AllChatsItem {
  characterAvatar: string;
  characterName: string;
  chatFile: string;
  lastMessage: string;
  lastDate: string;
  messageCount: number;
  fileSize: number;
}

// ── Generation Types ────────────────────────────────────────────────────────

export interface ChatCompletionMessage {
  role: string;
  content: string;
}

export interface GenerateTextParams {
  api_server: string;
  api_key?: string;
  prompt?: string;
  messages?: ChatCompletionMessage[];
  chat_template_kwargs?: Record<string, unknown>;
  max_length: number;
  max_context_length: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  rep_pen?: number;
  rep_pen_range?: number;
  presence_penalty?: number;
  stop_sequence?: string[];
}

export interface GeneratedScenario {
  name: string;
  content: string;
  tags: string[];
}

// ── Provider Types ──────────────────────────────────────────────────────────

export enum ProviderType {
  KoboldCpp = 'koboldcpp',
  Custom = 'custom',
  // future: OpenAI = 'openai', OpenRouter = 'openrouter', Ollama = 'ollama'
}

/** Per-provider connection configuration (URL, API key, etc.) */
export interface ProviderConfig {
  url: string;
  apiKey?: string;
}

/** Describes a single field in the provider configuration form (from backend). */
export interface ProviderFieldDef {
  key: string;
  type: 'text' | 'password';
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
}

/** Provider definition returned by GET /api/providers. */
export interface ProviderDefinition {
  type: string;
  label: string;
  fields: ProviderFieldDef[];
}

// ── App Settings Types ──────────────────────────────────────────────────────

export interface ServerUrls {
  koboldcpp?: string;
}

export interface TextGenSettings {
  api_server?: string;
  server_urls?: ServerUrls;
  streaming_kobold?: boolean;
}

export interface AppSettings {
  textgenerationwebui?: TextGenSettings;
}

// ── Chat File Types ─────────────────────────────────────────────────────────

export interface ChatMetadata {
  activeScenarioName?: string;
  customSamplerSettings?: Partial<SamplerSettings>;
  customSystemPrompt?: string | null;
}

export interface ChatHeader {
  chat_metadata: ChatMetadata;
  user_name: string;
  character_name: string;
}

export type ChatLine = ChatHeader | ChatMessage;

// ── Chat Build Types ────────────────────────────────────────────────────────

export interface ChatBuildResult {
  prompt: string;
  messages: ChatCompletionMessage[];
}

// ── Preset Types ────────────────────────────────────────────────────────────

export interface TextGenPresetData {
  name: string;
  temp: number;
  top_p: number;
  top_k: number;
  min_p: number;
  rep_pen: number;
  rep_pen_range: number;
  [key: string]: unknown;
}

// ── Per-model Settings ─────────────────────────────────────────────────────

/** Per-model settings (context size overrides, etc.) */
export interface ModelSettings {
  contextSize?: number;
}

// ── LLM Server Types ───────────────────────────────────────────────────────

export interface LlmStartConfig {
  modelPath: string;
  port: number;
  gpuLayers: number;
  contextSize: number;
  flashAttention: boolean;
  threads: number;
}

export interface EngineInfo {
  found: boolean;
  executablePath: string | null;
  defaultModelsDir: string;
}

export interface LlmServerStatus {
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'error';
  model: string | null;
  modelPath: string | null;
  error: string | null;
  port: number;
  pid: number | null;
}

export interface ModelFile {
  name: string;
  path: string;
  size: number;
}
