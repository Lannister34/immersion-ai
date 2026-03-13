import type { Character, WorldInfo, GeneratedCharacter, GeneratedLorebook } from '@/types';

let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/csrf-token');
  const data = await res.json() as { token: string };
  csrfToken = data.token;
  return csrfToken;
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  return fetchCsrfToken();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getCsrfToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    },
    body: JSON.stringify(body),
  });

  // If CSRF token expired (e.g. backend restarted), refresh and retry once
  if (res.status === 403) {
    const newToken = await fetchCsrfToken();
    const retry = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': newToken,
      },
      body: JSON.stringify(body),
    });
    if (!retry.ok) {
      let msg = `Ошибка сервера (${retry.status})`;
      try {
        const data = await retry.json() as { error?: string };
        if (data?.error) msg = data.error;
      } catch {
        const text = await retry.text().catch(() => '');
        if (text) msg = text;
      }
      throw new Error(msg);
    }
    return retry.json() as Promise<T>;
  }

  if (!res.ok) {
    let msg = `Ошибка сервера (${res.status})`;
    try {
      const data = await res.json() as { error?: string };
      if (data?.error) msg = data.error;
    } catch {
      const text = await res.text().catch(() => '');
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── User Settings (server-side persistence) ──────────────────────────────────

export async function getUserSettings(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('/api/user-settings');
    if (!res.ok) return null;
    const json = await res.json() as { ok: boolean; data: Record<string, unknown> | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function saveUserSettings(data: Record<string, unknown>): Promise<void> {
  await apiPost('/api/user-settings', data);
}

// ── Characters ────────────────────────────────────────────────────────────────

export async function getCharacters(): Promise<Character[]> {
  const data = await apiPost<Character[]>('/api/characters/all', {});
  return data;
}

/** Fetch a single character by avatar filename — much faster than getCharacters() */
export async function getCharacterByAvatar(avatar: string): Promise<Character | null> {
  try {
    const data = await apiPost<Character>('/api/characters/get-full', { avatar_url: avatar });
    return data;
  } catch {
    return null;
  }
}

export async function createCharacter(
  character: Omit<Character, 'avatar'>,
  avatarFile?: File,
): Promise<void> {
  const token = await getCsrfToken();
  const form = new FormData();
  form.append('ch_name', character.name);
  form.append('description', character.description);
  form.append('personality', character.personality);
  form.append('mes_example', character.mes_example);
  if (character.system_prompt) form.append('system_prompt', character.system_prompt);
  if (character.tags?.length) form.append('tags', character.tags.join(', '));
  if (character.world) form.append('world', character.world);
  if (avatarFile) {
    form.append('avatar', avatarFile);
  }
  const res = await fetch('/api/characters/create', {
    method: 'POST',
    headers: { 'x-csrf-token': token },
    body: form,
  });
  if (!res.ok) {
    let msg = `Ошибка сервера (${res.status})`;
    try {
      const data = await res.json() as { error?: string };
      if (data?.error) msg = data.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
}

// ── World Info ─────────────────────────────────────────────────────────────────

export async function getWorlds(): Promise<string[]> {
  const data = await apiPost<Array<{ file_id: string; name: string }>>('/api/worldinfo/list', {});
  return data.map((w) => w.name);
}

export async function getWorldInfo(name: string): Promise<WorldInfo> {
  return apiPost<WorldInfo>('/api/worldinfo/get', { name });
}

export async function saveWorldInfo(name: string, data: WorldInfo): Promise<void> {
  await apiPost('/api/worldinfo/edit', { name, data });
}

// ── Connection / Status ────────────────────────────────────────────────────────

export async function getConnectionStatus(): Promise<{ connected: boolean; model: string }> {
  try {
    // First get the KoboldCpp URL from settings
    const settings = await apiPost<Record<string, unknown>>('/api/settings/get', {});
    const textGen = settings?.textgenerationwebui as Record<string, unknown> | undefined;
    const urls = textGen?.server_urls as Record<string, string> | undefined;
    const rawUrl = urls?.koboldcpp ?? 'http://127.0.0.1:5001';

    // KoboldCpp uses /api/v1/... prefix, llama-server uses /v1/... directly
    const { backendMode } = await import('@/stores').then((m) => m.useAppStore.getState());
    const apiServer = backendMode === 'builtin'
      ? rawUrl
      : rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`;

    // Call ST's kobold status endpoint, which proxies to KoboldCpp
    const data = await apiPost<{ model: string; koboldCppVersion: string }>(
      '/api/backends/kobold/status',
      { api_server: apiServer },
    );
    const model = data.model === 'no_connection' ? '' : data.model;
    return { connected: !!model, model: model || '' };
  } catch {
    return { connected: false, model: '' };
  }
}

// ── Settings ───────────────────────────────────────────────────────────────────

interface SettingsResponse {
  settings: string; // raw JSON string
  textgenerationwebui_preset_names: string[];
  [key: string]: unknown;
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const data = await apiPost<SettingsResponse>('/api/settings/get', {});
  // settings is a raw JSON string; parse it
  try {
    return JSON.parse(data.settings) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function getTextGenPresets(): Promise<string[]> {
  const data = await apiPost<SettingsResponse>('/api/settings/get', {});
  return data.textgenerationwebui_preset_names ?? [];
}

// ── Chats ──────────────────────────────────────────────────────────────────────

export async function getChatMessages(
  avatarUrl: string,
  chatId: string,
): Promise<Record<string, unknown>[]> {
  return apiPost<Record<string, unknown>[]>('/api/chats/get', {
    avatar_url: avatarUrl,
    file_name: chatId,
  });
}

export async function saveChat(
  avatarUrl: string,
  chatId: string,
  chat: Record<string, unknown>[],
): Promise<void> {
  await apiPost('/api/chats/save', {
    avatar_url: avatarUrl,
    file_name: chatId,
    chat,
    force: true, // skip integrity check for our UI
  });
}

export interface ChatFileInfo {
  file_name: string;
  file_size: string;
  chat_items: number;
  mes: string;       // last message text
  last_mes: string;   // date of last message (ISO or timestamp)
}

export async function getCharacterChats(
  avatarUrl: string,
): Promise<ChatFileInfo[]> {
  const result = await apiPost<ChatFileInfo[] | { error: boolean }>('/api/characters/chats', { avatar_url: avatarUrl });
  // Backend returns {error: true} if chat directory doesn't exist
  if (!Array.isArray(result)) return [];
  return result;
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

/** Fetch all chat sessions across all characters in one call */
export async function getAllChats(): Promise<AllChatsItem[]> {
  return apiPost<AllChatsItem[]>('/api/chats/all', {});
}

export async function createNewChat(
  avatarUrl: string,
  characterName: string,
  firstMessage: string,
): Promise<string> {
  const chatId = `${Date.now()}`;
  const header = { chat_metadata: {}, user_name: '', character_name: characterName };
  const firstMsg = firstMessage
    ? {
        name: characterName,
        is_user: false,
        mes: firstMessage,
        send_date: new Date().toISOString(),
        extra: {},
      }
    : null;
  const chat = firstMsg ? [header, firstMsg] : [header];
  await saveChat(avatarUrl, chatId, chat);
  return chatId;
}

export async function deleteChat(avatarUrl: string, fileName: string): Promise<void> {
  const token = await getCsrfToken();
  const res = await fetch('/api/chats/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify({ avatar_url: avatarUrl, file_name: fileName }),
  });
  if (!res.ok) throw new Error(`Failed to delete chat: ${res.status}`);
}

// ── Abort Generation ──────────────────────────────────────────────────────────

export async function abortGeneration(): Promise<void> {
  await apiPost('/api/backends/kobold/abort', {});
}

// ── Text Generation ────────────────────────────────────────────────────────────

export interface ChatCompletionMessage {
  role: string;
  content: string;
}

interface GenerateTextParams {
  api_server: string;
  prompt?: string;                    // raw prompt (for /v1/generate)
  messages?: ChatCompletionMessage[]; // structured messages (for /v1/chat/completions)
  chat_template_kwargs?: Record<string, unknown>; // e.g. { enable_thinking: false }
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

export async function generateText(params: GenerateTextParams): Promise<string> {
  const token = await getCsrfToken();
  const res = await fetch('/api/backends/kobold/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    },
    body: JSON.stringify({
      ...params,
      streaming: false,
      can_abort: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Generation failed: ${res.status} ${text}`);
  }
  const data = await res.json() as { results?: Array<{ text: string }> };
  return data?.results?.[0]?.text ?? '';
}

// ── AI Generation (new endpoints) ─────────────────────────────────────────────

export async function generateCharacter(concept: string, language: string = 'ru'): Promise<GeneratedCharacter> {
  return apiPost<GeneratedCharacter>('/api/ai-generation/character', { concept, language });
}

export async function regenerateCharacterField(
  field: string,
  character: GeneratedCharacter,
  concept: string,
  language: string = 'ru',
): Promise<string> {
  const result = await apiPost<{ field: string; value: string }>(
    '/api/ai-generation/character-field',
    { field, character, concept, language },
  );
  return result.value;
}

export async function generateAvatarPrompt(
  characterData: GeneratedCharacter,
): Promise<{ positive: string; negative: string }> {
  return apiPost<{ positive: string; negative: string }>(
    '/api/ai-generation/character-avatar-prompt',
    { characterData },
  );
}

export async function generateLorebook(
  concept: string,
  entryCount: number,
  language?: string,
): Promise<GeneratedLorebook> {
  return apiPost<GeneratedLorebook>('/api/ai-generation/lorebook', { concept, entryCount, language });
}

export interface GeneratedScenario {
  name: string;
  content: string;
  tags: string[];
}

export async function generateScenario(
  concept: string,
  language = 'ru',
  character?: { name: string; description?: string; personality?: string },
  lorebookEntries?: Array<{ comment: string; keys: string[]; content?: string }>,
  user?: { name: string; persona?: string },
): Promise<GeneratedScenario> {
  return apiPost<GeneratedScenario>('/api/ai-generation/scenario', {
    concept, language, character, lorebookEntries, user,
  });
}

export async function generateFirstMessage(
  character: { name: string; description?: string; personality?: string },
  scenario?: string,
  user?: { name: string; persona?: string },
  language = 'ru',
): Promise<string> {
  const data = await apiPost<{ first_mes: string }>('/api/ai-generation/first-message', {
    character, scenario, user, language,
  });
  return data.first_mes;
}

export async function generateChatTitle(
  messages: Array<{ name: string; mes: string }>,
  characterName: string,
): Promise<string> {
  const data = await apiPost<{ title: string }>('/api/ai-generation/chat-title', {
    messages,
    characterName,
  });
  return data.title;
}

// ── Character Edit / Delete ──────────────────────────────────────────────────

export async function editCharacter(
  avatarUrl: string,
  character: Partial<Character>,
  avatarFile?: File,
): Promise<void> {
  const token = await getCsrfToken();
  const form = new FormData();
  form.append('avatar_url', avatarUrl);
  form.append('ch_name', character.name ?? '');
  form.append('description', character.description ?? '');
  form.append('personality', character.personality ?? '');
  form.append('mes_example', character.mes_example ?? '');
  if (character.tags?.length) {
    form.append('tags', character.tags.join(', '));
  }
  if (character.world !== undefined) form.append('world', character.world ?? '');
  if (avatarFile) form.append('avatar', avatarFile);
  const res = await fetch('/api/characters/edit', {
    method: 'POST',
    headers: { 'x-csrf-token': token },
    body: form,
  });
  if (!res.ok) {
    let msg = `Ошибка сервера (${res.status})`;
    try {
      const data = await res.json() as { error?: string };
      if (data?.error) msg = data.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
}

export async function deleteCharacter(
  avatarUrl: string,
  deleteChats = true,
): Promise<void> {
  await apiPost('/api/characters/delete', {
    avatar_url: avatarUrl,
    delete_chats: deleteChats,
  });
}

// ── World Info Delete ────────────────────────────────────────────────────────

export async function deleteWorldInfo(name: string): Promise<void> {
  await apiPost('/api/worldinfo/delete', { name });
}

// ── Scenarios ────────────────────────────────────────────────────────────────

import type { Scenario, ScenarioSummary } from '@/types';

export async function getScenarios(): Promise<ScenarioSummary[]> {
  return apiPost<ScenarioSummary[]>('/api/scenarios/list', {});
}

export async function getScenario(name: string): Promise<Scenario> {
  return apiPost<Scenario>('/api/scenarios/get', { name });
}

export async function createScenario(scenario: {
  name: string;
  content?: string;
  tags?: string[];
  concept?: string;
}): Promise<void> {
  await apiPost('/api/scenarios/create', scenario);
}

export async function saveScenario(name: string, data: Scenario): Promise<void> {
  await apiPost('/api/scenarios/edit', { name, data });
}

export async function deleteScenario(name: string): Promise<void> {
  await apiPost('/api/scenarios/delete', { name });
}

// ── Preset Loading ──────────────────────────────────────────────────────────

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

export async function getTextGenPresetsWithData(): Promise<TextGenPresetData[]> {
  const data = await apiPost<{
    textgenerationwebui_presets: string[];
    textgenerationwebui_preset_names: string[];
  }>('/api/settings/get', {});
  const names = data.textgenerationwebui_preset_names ?? [];
  const contents = data.textgenerationwebui_presets ?? [];
  return names.map((name, i) => {
    const parsed = typeof contents[i] === 'string'
      ? JSON.parse(contents[i]) as TextGenPresetData
      : (contents[i] as unknown as TextGenPresetData);
    return { ...parsed, name };
  });
}

// ── Streaming Text Generation ───────────────────────────────────────────────

export async function generateTextStream(
  params: GenerateTextParams,
  onToken: (text: string) => void,
  signal?: AbortSignal,
  streaming = true,
): Promise<string> {
  const token = await getCsrfToken();

  // Choose endpoint: chat completions (messages) or raw prompt
  const useChatCompletions = !!params.messages;
  const endpoint = useChatCompletions
    ? '/api/backends/kobold/generate-chat'
    : '/api/backends/kobold/generate';

  const requestBody = JSON.stringify({
    ...params,
    streaming,
    can_abort: true,
  });
  let res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    },
    body: requestBody,
    signal,
  });

  // Retry once on CSRF mismatch (backend may have restarted)
  if (res.status === 403) {
    const newToken = await fetchCsrfToken();
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': newToken,
      },
      body: requestBody,
      signal,
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Generation failed: ${res.status} ${text}`);
  }

  // If the response is streaming (SSE), read chunks
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    // Listen for abort to cancel the reader
    const abortHandler = () => {
      reader.cancel().catch(() => {});
    };
    signal?.addEventListener('abort', abortHandler);

    // Thinking models (Qwen3.5, etc.) stream reasoning_content first, then content.
    // We accumulate both and wrap reasoning in <think> tags.
    let thinkingText = '';
    let contentText = '';
    let wasThinking = false;

    try {
      while (true) {
        if (signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // SSE format: "data: {...}\n\n"
        // Supports KoboldCpp raw, OpenAI chat completions, and thinking models
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const jsonStr = line.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed?.choices?.[0]?.delta;

              // KoboldCpp raw format
              const koboldToken = parsed?.token ?? parsed?.results?.[0]?.text;
              if (koboldToken) {
                fullText += koboldToken;
                onToken(fullText);
                continue;
              }

              // OpenAI chat completions format — handle reasoning_content + content
              const reasoning = delta?.reasoning_content ?? '';
              const content = delta?.content ?? '';

              if (reasoning) {
                if (!wasThinking) {
                  wasThinking = true;
                  thinkingText = '';
                }
                thinkingText += reasoning;
              }

              if (content) {
                contentText += content;
              }

              if (reasoning || content) {
                // Rebuild fullText from accumulated thinking + content
                fullText = '';
                if (thinkingText) {
                  if (contentText) {
                    // Thinking done, content started — close the tag
                    fullText += `<think>\n${thinkingText}\n</think>\n\n`;
                  } else {
                    // Still thinking — leave tag OPEN so streaming UI
                    // renders it as pulsing ".think-block-open"
                    fullText += `<think>\n${thinkingText}`;
                  }
                }
                fullText += contentText;
                onToken(fullText);
              }
            } catch {
              // ignore parse errors in stream
            }
          }
        }
      }
    } finally {
      signal?.removeEventListener('abort', abortHandler);
    }

    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    return fullText;
  }

  // Fallback: non-streaming response
  try {
    const data = await res.json() as { results?: Array<{ text: string }>; error?: unknown };
    if (data?.error) {
      throw new Error('Ошибка генерации: сервер вернул ошибку');
    }
    const text = data?.results?.[0]?.text ?? '';
    onToken(text);
    return text;
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error('Ошибка генерации: не удалось получить ответ от модели. Проверьте, загружена ли модель.');
    }
    throw e;
  }
}

// ── LLM Server Management ─────────────────────────────────────────────────

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

export async function startLlmServer(config: LlmStartConfig): Promise<void> {
  await apiPost('/api/llm-server/start', config);
}

export async function stopLlmServer(): Promise<void> {
  await apiPost('/api/llm-server/stop', {});
}

export async function getLlmServerStatus(): Promise<LlmServerStatus> {
  const res = await fetch('/api/llm-server/status');
  return res.json() as Promise<LlmServerStatus>;
}

export async function listModelFiles(modelsDir: string): Promise<ModelFile[]> {
  const data = await apiPost<{ models: ModelFile[] }>('/api/llm-server/models', { modelsDir });
  return data.models;
}

export async function getLlmServerLogs(): Promise<string[]> {
  const res = await fetch('/api/llm-server/logs');
  const data = await res.json() as { lines: string[] };
  return data.lines;
}

export async function getEngineInfo(): Promise<EngineInfo> {
  const res = await fetch('/api/llm-server/engine');
  return res.json() as Promise<EngineInfo>;
}

export async function browseFolder(initialDir?: string): Promise<string | null> {
  const data = await apiPost<{ path: string | null }>('/api/llm-server/browse-folder', { initialDir });
  return data.path;
}

export async function browseFile(filter?: string, initialDir?: string): Promise<string | null> {
  const data = await apiPost<{ path: string | null }>('/api/llm-server/browse-file', { filter, initialDir });
  return data.path;
}
