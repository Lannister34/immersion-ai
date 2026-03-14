import type { GeneratedCharacter, GeneratedLorebook } from '@/types';
import { apiPost, getCsrfToken, fetchCsrfToken } from './client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatCompletionMessage {
  role: string;
  content: string;
}

export interface GenerateTextParams {
  api_server: string;
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

// ── Abort ────────────────────────────────────────────────────────────────────

export async function abortGeneration(): Promise<void> {
  await apiPost('/api/backends/kobold/abort', {});
}

// ── Non-streaming Generation ─────────────────────────────────────────────────

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

// ── Streaming Generation ─────────────────────────────────────────────────────

export async function generateTextStream(
  params: GenerateTextParams,
  onToken: (text: string) => void,
  signal?: AbortSignal,
  streaming = true,
): Promise<string> {
  const token = await getCsrfToken();

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

  // Retry once on CSRF mismatch
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

  // SSE streaming response
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    const abortHandler = () => { reader.cancel().catch(() => {}); };
    signal?.addEventListener('abort', abortHandler);

    // Thinking models (Qwen3.5, etc.) stream reasoning_content first, then content.
    let thinkingText = '';
    let contentText = '';
    let wasThinking = false;

    try {
      while (true) {
        if (signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
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
                fullText = '';
                if (thinkingText) {
                  if (contentText) {
                    fullText += `<think>\n${thinkingText}\n</think>\n\n`;
                  } else {
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

// ── AI Generation Endpoints ──────────────────────────────────────────────────

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
