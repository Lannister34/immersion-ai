/**
 * AI Generation endpoints: character cards, avatar prompts, lorebooks, chat titles.
 * Uses KoboldCpp for text generation.
 */

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_ROOT } from '../lib/paths.js';

export const router = Router();

/** Read KoboldCpp API server URL from settings */
function getApiServer(): string {
  try {
    const settingsPath = path.join(DATA_ROOT, 'settings.json');
    if (!fs.existsSync(settingsPath)) return 'http://127.0.0.1:5001';
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    const url =
      settings?.textgenerationwebui?.server_urls?.koboldcpp ??
      settings?.api_server ??
      'http://127.0.0.1:5001';
    return url.replace(/\/api$/, '');
  } catch {
    return 'http://127.0.0.1:5001';
  }
}

/** Options for callLlm */
interface LlmCallOptions {
  maxTokens?: number;
  temperature?: number;
}

/** Call LLM via OpenAI-compatible /v1/chat/completions (works with llama-server, KoboldCpp, vLLM) */
async function callLlm(
  apiServer: string,
  systemPrompt: string,
  userPrompt: string,
  options: LlmCallOptions = {},
): Promise<string> {
  const { maxTokens = 2048, temperature = 0.8 } = options;
  const body = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
    top_p: 0.9,
    min_p: 0.05,
    // Disable thinking for utility tasks (title generation, character creation, etc.)
    chat_template_kwargs: { enable_thinking: false },
  };

  let res: Response;
  try {
    res = await fetch(`${apiServer}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
  } catch (fetchErr) {
    if (fetchErr instanceof DOMException && fetchErr.name === 'TimeoutError' ||
        fetchErr instanceof Error && fetchErr.name === 'TimeoutError') {
      throw new Error('Превышено время ожидания ответа от LLM (2 мин). Попробуйте уменьшить длину запроса.');
    }
    if (fetchErr instanceof TypeError) {
      throw new Error(`Не удалось подключиться к LLM серверу (${apiServer}). Проверьте, что сервер запущен.`);
    }
    throw fetchErr;
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`[callLlm] LLM error ${res.status}: ${text}`);
    throw new Error(`Ошибка LLM (${res.status}). Проверьте, загружена ли модель.`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  const choice = data?.choices?.[0]?.message;
  // Prefer content; fall back to reasoning_content for thinking models
  return choice?.content || choice?.reasoning_content || '';
}

/** Extract JSON from LLM output (handles markdown code blocks + common LLM errors) */
function extractJson(text: string): unknown {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = codeBlock ? codeBlock[1] : text;
  const firstBrace = jsonStr.search(/[{[]/);
  const lastBrace = Math.max(
    jsonStr.lastIndexOf('}'),
    jsonStr.lastIndexOf(']'),
  );
  if (firstBrace === -1 || lastBrace === -1)
    throw new Error('No JSON found in response');
  const raw = jsonStr.slice(firstBrace, lastBrace + 1);

  // 1) Try parsing as-is
  try { return JSON.parse(raw); } catch { /* proceed to repair */ }

  // 2) Repair: escape unescaped control chars and fix invalid escapes inside string values.
  //    Walk through chars, track when we're inside a JSON string.
  let repaired = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) {
      // Valid JSON escapes: " \ / b f n r t u
      if ('"\\\/bfnrtu'.includes(ch)) {
        repaired += ch;
      } else {
        // Invalid escape like \* \. \' — drop the backslash, keep char
        repaired = repaired.slice(0, -1) + ch;
      }
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      repaired += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      repaired += ch;
    } else if (inString) {
      if (ch === '\n') repaired += '\\n';
      else if (ch === '\r') repaired += '\\r';
      else if (ch === '\t') repaired += '\\t';
      else repaired += ch;
    } else {
      repaired += ch;
    }
  }
  // Remove trailing commas before } or ]
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  try { return JSON.parse(repaired); } catch { /* proceed to fallback */ }

  // 3) Last resort: extract fields via regex
  try {
    const extract = (field: string): string => {
      const re = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
      const m = repaired.match(re);
      return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : '';
    };
    const tagsMatch = repaired.match(/"tags"\s*:\s*\[([^\]]*)\]/);
    const tags = tagsMatch
      ? (tagsMatch[1].match(/"((?:[^"\\]|\\.)*)"/g) || []).map(s => s.slice(1, -1))
      : [];
    return {
      name: extract('name'),
      content: extract('content'),
      tags,
    };
  } catch { /* give up */ }

  throw new Error('Failed to parse JSON from LLM response');
}

/**
 * Build a regex that matches a name in any Russian case form.
 * Strategy: strip the last vowel-like ending to get a stem,
 * then match stem + up to 3 Cyrillic chars (covers all declension suffixes).
 * For non-Cyrillic names, falls back to exact match with word boundaries.
 */
function nameToRegex(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/^[\u0400-\u04FF]+$/.test(name) && name.length >= 3) {
    const stem = name.replace(/[аяоеёиыйьую]$/i, '');
    if (stem.length >= 2) {
      const stemEscaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?<![\\u0400-\\u04FF])${stemEscaped}[\\u0400-\\u04FF]{0,3}(?![\\u0400-\\u04FF])`, 'gi');
    }
  }
  return new RegExp(`\\b${escaped}\\b`, 'gi');
}

/** Replace real character/user names with {{char}}/{{user}} placeholders */
function replaceNamesWithPlaceholders(
  text: string,
  charName?: string,
  userName?: string,
): string {
  if (charName) text = text.replace(nameToRegex(charName), '{{char}}');
  if (userName) text = text.replace(nameToRegex(userName), '{{user}}');
  return text;
}

// ── POST /api/ai-generation/character ────────────────────────────────────────

router.post('/character', async (req, res) => {
  try {
    const { concept, language } = req.body;
    if (!concept?.trim())
      return res.status(400).json({ error: 'concept is required' });

    const apiServer = getApiServer();
    const lang = language === 'en' ? 'English' : 'Russian';

    const isRu = language !== 'en';
    const systemPrompt = isRu
      ? 'Ты составляешь карточки персонажей для ролевого чат-приложения. Возвращай ТОЛЬКО валидный JSON, без другого текста.'
      : 'You are a character card writer for a roleplay chat app. Return ONLY valid JSON, no other text.';

    const userPrompt = isRu
      ? `Концепция персонажа: ${concept}

Верни JSON-объект с такими полями:
{
  "name": "Полное имя персонажа",
  "description": "Внешность + статус/роль. Кратко и по существу, как справочная карточка — НЕ литературный текст. Укажи: волосы, глаза, рост, телосложение, заметные физические особенности, типичная одежда/стиль, социальная роль или занятие (например: школьница, официантка, детектив). Максимум 1-2 коротких абзаца.",
  "personality": "Ключевые черты характера, манера речи, привычки, особенности. Компактный список или 1-2 коротких абзаца.",
  "mes_example": "<START>\\n{{user}}: пример сообщения\\n{{char}}: пример ответа\\n<START>\\n{{user}}: ещё пример\\n{{char}}: ещё ответ",
  "tags": ["тег1", "тег2", "тег3"]
}

ВАЖНО: "description" — это НЕ биография и НЕ предыстория. Это визуальная справочная карточка. НЕ включай историю, мотивации или художественную прозу.
Пиши на русском. Конкретно и кратко.`
      : `Character concept: ${concept}

Return a JSON object with these exact fields:
{
  "name": "Character's full name",
  "description": "Physical appearance + role/status. Keep it concise and factual, like a reference card — NOT a literary text. Include: hair, eyes, height, build, notable physical features, typical clothing/style, social role or occupation (e.g. schoolgirl, waitress, detective). 1-2 short paragraphs max.",
  "personality": "Key personality traits, speech patterns, quirks, habits. Write as a compact list or 1-2 short paragraphs.",
  "mes_example": "<START>\\n{{user}}: example message\\n{{char}}: example response\\n<START>\\n{{user}}: another example\\n{{char}}: another response",
  "tags": ["tag1", "tag2", "tag3"]
}

IMPORTANT: "description" is NOT a backstory or biography. It is a physical/visual reference card. Do NOT include history, motivations, or narrative prose.
Write in English. Be specific but brief.`;

    const raw = await callLlm(apiServer, systemPrompt, userPrompt, { maxTokens: 2048 });
    const character = extractJson(raw) as Record<string, unknown>;

    const required = [
      'name',
      'description',
      'personality',
      'mes_example',
      'tags',
    ];
    for (const field of required) {
      if (!character[field]) character[field] = '';
    }
    if (!Array.isArray(character.tags)) character.tags = [];

    res.json(character);
  } catch (err) {
    console.error('[ai-generation/character]', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/ai-generation/character-field ───────────────────────────────────

const FIELD_INSTRUCTIONS: Record<string, { en: string; ru: string }> = {
  name: {
    en: 'Generate a fitting full name for this character.',
    ru: 'Придумай подходящее полное имя для этого персонажа.',
  },
  description: {
    en: 'Write a concise physical/visual reference: hair, eyes, height, build, notable features, typical clothing, social role/occupation. 1-2 short paragraphs. Do NOT include backstory, history, or narrative prose.',
    ru: 'Напиши краткую визуальную справку: волосы, глаза, рост, телосложение, заметные особенности, типичная одежда, социальная роль/занятие. 1-2 коротких абзаца. НЕ включай предысторию или художественную прозу.',
  },
  personality: {
    en: 'Describe key personality traits, speech style, quirks, and habits.',
    ru: 'Опиши ключевые черты характера, манеру речи, привычки и особенности.',
  },
  mes_example: {
    en: 'Write 2 example dialogue exchanges in this format:\n<START>\\n{{user}}: example message\\n{{char}}: example response\\n<START>\\n{{user}}: another example\\n{{char}}: another response',
    ru: 'Напиши 2 примера диалогов в таком формате:\n<START>\\n{{user}}: пример сообщения\\n{{char}}: пример ответа\\n<START>\\n{{user}}: ещё пример\\n{{char}}: ещё ответ',
  },
};

router.post('/character-field', async (req, res) => {
  try {
    const { field, character, concept, language } = req.body;
    if (!field || !character)
      return res.status(400).json({ error: 'field and character are required' });

    const fieldInstr = FIELD_INSTRUCTIONS[field];
    if (!fieldInstr)
      return res.status(400).json({ error: `Unknown field: ${field}` });

    const apiServer = getApiServer();
    const isRu = language !== 'en';
    const instruction = isRu ? fieldInstr.ru : fieldInstr.en;

    const systemPrompt = isRu
      ? 'Ты составляешь карточки персонажей для ролевого чат-приложения. Пиши кратко и по существу — без литературной прозы и пышных описаний. Возвращай ТОЛЬКО запрошенный контент простым текстом, без JSON, без названий полей, без лишнего форматирования.'
      : 'You are a character card writer for a roleplay chat app. Write concise, factual content — avoid literary prose or elaborate descriptions. Return ONLY the requested content as plain text, no JSON, no field names, no extra formatting.';

    const userPrompt = isRu
      ? `Исходная концепция: ${concept || 'не указана'}

Текущая карточка персонажа:
- Имя: ${character.name}
- Описание: ${character.description}
- Характер: ${character.personality}

Задача: Перегенерируй ТОЛЬКО поле "${field}". ${instruction}

Пиши на русском. Сохраняй согласованность с остальной карточкой. Верни ТОЛЬКО новое значение поля "${field}", ничего больше.`
      : `Original concept: ${concept || 'not provided'}

Current character card:
- Name: ${character.name}
- Description: ${character.description}
- Personality: ${character.personality}

Task: Regenerate ONLY the "${field}" field. ${instruction}

Write in English. Keep it consistent with the rest of the character card. Return ONLY the new value for "${field}", nothing else.`;

    const raw = await callLlm(apiServer, systemPrompt, userPrompt, { maxTokens: 1024 });
    res.json({ field, value: raw.trim() });
  } catch (err) {
    console.error('[ai-generation/character-field]', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/ai-generation/character-avatar-prompt ──────────────────────────

router.post('/character-avatar-prompt', async (req, res) => {
  try {
    const { characterData } = req.body;
    if (!characterData)
      return res.status(400).json({ error: 'characterData is required' });

    const apiServer = getApiServer();

    const systemPrompt =
      'You are an expert at writing Stable Diffusion image generation prompts. Return ONLY valid JSON.';

    const userPrompt = `Generate a Stable Diffusion portrait prompt for this character:
Name: ${characterData.name}
Description: ${characterData.description}
Personality: ${characterData.personality}

Return JSON:
{
  "positive": "comma-separated SD tags: subject description, art style (anime/realistic), quality tags like (masterpiece, best quality, detailed), lighting, colors",
  "negative": "ugly, deformed, blurry, low quality, extra limbs, bad anatomy"
}`;

    const raw = await callLlm(apiServer, systemPrompt, userPrompt, { maxTokens: 512 });
    const result = extractJson(raw) as Record<string, string>;

    res.json({
      positive: result.positive ?? '',
      negative: result.negative ?? '',
    });
  } catch (err) {
    console.error('[ai-generation/character-avatar-prompt]', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/ai-generation/chat-title ───────────────────────────────────────

router.post('/chat-title', async (req, res) => {
  try {
    const { messages, characterName } = req.body;
    if (!messages?.length)
      return res.status(400).json({ error: 'messages are required' });

    const apiServer = getApiServer();

    const systemPrompt =
      'You generate very short chat titles (2-5 words) that capture the essence of a conversation. Return ONLY the title text, nothing else. No quotes, no punctuation at the end. Write in the same language as the conversation.';

    const chatSnippet = messages
      .slice(0, 6)
      .map(
        (m: { name: string; mes?: string }) =>
          `${m.name}: ${m.mes?.slice(0, 150) ?? ''}`,
      )
      .join('\n');

    const userPrompt = `Generate a short title (2-5 words) for this roleplay conversation with character "${characterName}":\n\n${chatSnippet}\n\nTitle:`;

    const raw = await callLlm(apiServer, systemPrompt, userPrompt, { maxTokens: 30 });

    const title = raw
      .split('\n')[0]
      .replace(/^["'«]|["'»]$/g, '')
      .replace(/[.!?]$/, '')
      .trim();

    res.json({ title: title || `Чат с ${characterName}` });
  } catch (err) {
    console.error('[ai-generation/chat-title]', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/ai-generation/lorebook ─────────────────────────────────────────

router.post('/lorebook', async (req, res) => {
  try {
    const { concept, entryCount = 8, language } = req.body;
    if (!concept?.trim())
      return res.status(400).json({ error: 'concept is required' });

    const apiServer = getApiServer();
    const count = Math.min(Math.max(Number(entryCount) || 8, 3), 20);
    const isRu = language !== 'en';

    const systemPrompt = isRu
      ? 'Ты — помощник по построению миров. Генерируй записи лорбука для ролевой игры. Возвращай ТОЛЬКО валидный JSON.'
      : 'You are a worldbuilding assistant. Generate world info entries for a roleplay lorebook. Return ONLY valid JSON.';

    const userPrompt = isRu
      ? `Создай ${count} записей лорбука для этого сеттинга: ${concept}

Верни JSON-объект:
{
  "entries": [
    {
      "key": ["ключевое_слово1", "ключевое_слово2"],
      "comment": "Краткий заголовок записи (например: 'Столица', 'Система магии')",
      "content": "2-4 предложения лора, которые подставляются в чат при появлении ключевых слов"
    }
  ]
}

Каждая запись должна покрывать отдельный аспект мира: локации, фракции, персонажи, история, технологии/магия, культура. Пиши на русском.`
      : `Create ${count} world info lorebook entries for this setting: ${concept}

Return a JSON object:
{
  "entries": [
    {
      "key": ["keyword1", "keyword2"],
      "comment": "Entry title/description (short, like 'Capital City' or 'Magic System')",
      "content": "2-4 sentences of lore content that gets injected when keywords appear in chat"
    }
  ]
}

Each entry should cover a distinct aspect of the world. Cover: locations, factions, characters, history, technology/magic, culture. Write in English.`;

    const raw = await callLlm(apiServer, systemPrompt, userPrompt, { maxTokens: 3000 });
    const result = extractJson(raw) as Record<string, unknown>;

    const entries = Array.isArray(result?.entries)
      ? result.entries
      : Array.isArray(result)
        ? result
        : [];

    const normalized = (entries as Array<Record<string, unknown>>).map((e) => ({
      key: Array.isArray(e.key) ? e.key : [String(e.key ?? '')],
      comment: String(e.comment ?? ''),
      content: String(e.content ?? ''),
    }));

    res.json({ entries: normalized });
  } catch (err) {
    console.error('[ai-generation/lorebook]', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/ai-generation/scenario ─────────────────────────────────────────

/** Build a summarization prompt for character + lorebook data */
function buildSummaryPrompt(
  character?: { name?: string; description?: string; personality?: string },
  lorebookEntries?: Array<{ comment?: string; keys?: string[]; content?: string }>,
  isRu = true,
): string {
  let prompt = isRu
    ? 'Извлеки ключевые факты из следующих ролевых данных в краткую структурированную справку.\n'
    : 'Extract key facts from the following roleplay data into a short structured brief.\n';

  if (character && (character.description || character.personality)) {
    const nameLabel = isRu ? 'Имя' : 'Name';
    const descLabel = isRu ? 'Описание' : 'Description';
    const persLabel = isRu ? 'Характер' : 'Personality';
    prompt += `\n=== ${isRu ? 'ПЕРСОНАЖ' : 'CHARACTER'} ===\n${nameLabel}: ${character.name || 'N/A'}`;
    if (character.description) prompt += `\n${descLabel}: ${character.description}`;
    if (character.personality) prompt += `\n${persLabel}: ${character.personality}`;
  }

  if (Array.isArray(lorebookEntries) && lorebookEntries.length > 0) {
    const entries = lorebookEntries
      .filter((e) => e.content?.trim())
      .map((e) => `- ${e.comment || '(unnamed)'}: ${e.content}`)
      .join('\n');
    if (entries) prompt += `\n\n=== ${isRu ? 'ИНФОРМАЦИЯ О МИРЕ' : 'WORLD INFO'} ===\n${entries}`;
  }

  prompt += isRu
    ? `\n\nВерни краткую JSON-справку:
{
  "char_gender": "мужской/женский/другой",
  "char_age": "примерный возраст или диапазон",
  "char_role": "профессия или роль в 3-5 словах",
  "char_traits": ["черта1", "черта2", "черта3"],
  "char_key_facts": "1-2 предложения ключевых фактов",
  "setting": "тип сеттинга и место",
  "world_facts": "ключевые правила мира в 1-2 предложениях",
  "dynamics": "динамика отношений или взаимодействия в 1 предложении"
}

Включай только поля с данными. Кратко — не более 300 токенов. Пиши на русском.`
    : `\n\nReturn a concise JSON brief:
{
  "char_gender": "male/female/other",
  "char_age": "approximate age or age range",
  "char_role": "profession or role in 3-5 words",
  "char_traits": ["trait1", "trait2", "trait3"],
  "char_key_facts": "1-2 sentences of essential backstory",
  "setting": "setting type and location",
  "world_facts": "key world rules or facts in 1-2 sentences",
  "dynamics": "relationship or interaction dynamic in 1 sentence"
}

Only include fields that have data. Be concise — total output under 300 tokens.`;
  return prompt;
}

router.post('/scenario', async (req, res) => {
  try {
    const { concept, language, character, lorebookEntries, user } = req.body;
    if (!concept?.trim())
      return res.status(400).json({ error: 'concept is required' });

    const apiServer = getApiServer();
    const isRu = language !== 'en';

    // ── Step 1: Summarize character + world into a brief (if data provided) ──
    const hasCharData = character && (character.description || character.personality);
    const hasLoreContent = Array.isArray(lorebookEntries) &&
      lorebookEntries.some((e: { content?: string }) => e.content?.trim());
    const needsSummary = hasCharData || hasLoreContent;

    let brief: Record<string, unknown> | null = null;
    if (needsSummary) {
      try {
        const summarySystem = isRu
          ? 'Ты — помощник по извлечению данных. Извлеки ключевые структурированные факты из данных ролевого персонажа и мира. Возвращай ТОЛЬКО валидный JSON, без другого текста.'
          : 'You are a data extraction assistant. Extract key structured facts from roleplay character and world data. Return ONLY valid JSON, no other text.';
        const summaryUser = buildSummaryPrompt(character, lorebookEntries, isRu);
        console.log('[scenario] Step 1: summarizing character/world data...');
        console.log('[scenario] Step 1 system prompt:\n%s', summarySystem);
        console.log('[scenario] Step 1 user prompt:\n%s', summaryUser);
        const briefRaw = await callLlm(apiServer, summarySystem, summaryUser, {
          maxTokens: 400,
          temperature: 0.3,
        });
        brief = extractJson(briefRaw) as Record<string, unknown>;
        console.log('[scenario] Step 1 done, brief:\n%s', JSON.stringify(brief, null, 2));
      } catch (err) {
        console.warn('[scenario] Step 1 (summary) failed, falling back to raw data:', err);
        brief = null;
      }
    }

    // ── Step 2: Generate scenario ────────────────────────────────────────────
    const systemPrompt = isRu
      ? `Ты — помощник для создания ролевых сценариев.
ОБЯЗАТЕЛЬНО: Во ВСЁМ тексте используй буквальные плейсхолдеры {{user}} и {{char}} для обозначения игрока и персонажа. НИКОГДА не подставляй настоящие имена — пиши именно {{user}} и {{char}} как шаблонные переменные.
ВАЖНО: Сценарий описывает СИТУАЦИЮ, а не персонажей. НЕ повторяй описания персонажей, черты, внешность или предысторию — эта информация уже есть в карточке персонажа. Сосредоточься на: месте действия, что происходит, какие обстоятельства свели {{user}} и {{char}}, какой конфликт или зацепка движет взаимодействием.
Возвращай ТОЛЬКО валидный JSON, без другого текста.`
      : `You are a creative writing assistant specializing in roleplay scenarios.
MANDATORY: In ALL output text, use the literal placeholders {{user}} and {{char}} to refer to the player and the character respectively. NEVER substitute real names — write exactly {{user}} and {{char}} as template variables.
IMPORTANT: The scenario describes a SITUATION, not the characters. Do NOT repeat character descriptions, traits, appearance, or backstory — that information is already in the character card. Focus on: where the scene takes place, what is happening, what circumstances brought {{user}} and {{char}} together, and what tension or hook drives the interaction.
Return ONLY valid JSON, no other text.`;

    let contextBlock = '';

    // User context — helps the model determine gender/style for {{user}}
    if (user && (user.name || user.persona)) {
      contextBlock += isRu
        ? `\n\nИнформация об игроке (для определения грамматического рода {{user}} — но пиши {{user}} в тексте, не имя):
- Имя: ${user.name || 'Н/Д'}${user.persona ? `\n- Персона: ${user.persona}` : ''}`
        : `\n\nPlayer info (for determining {{user}}'s grammatical gender — but still write {{user}} in output, not the name):
- Name: ${user.name || 'N/A'}${user.persona ? `\n- Persona: ${user.persona}` : ''}`;
    }

    if (brief) {
      contextBlock += isRu
        ? `\n\nСправка по персонажу и миру (сжатая из карточки и лорбука):
${JSON.stringify(brief, null, 2)}
Имя персонажа (для подстановки {{char}}): ${character?.name ?? 'Н/Д'}`
        : `\n\nCharacter & World Brief (condensed from character card and world info):
${JSON.stringify(brief, null, 2)}
Character name (for {{char}} substitution): ${character?.name ?? 'N/A'}`;
    } else {
      if (character && character.name) {
        contextBlock += isRu
          ? `\n\nИнформация о персонаже (только для контекста — пиши {{char}} в тексте, НИКОГДА "${character.name}"):
- Имя: ${character.name}
- Описание: ${character.description || 'Н/Д'}
- Характер: ${character.personality || 'Н/Д'}`
          : `\n\nCharacter info (for context only — write {{char}} in output, NEVER "${character.name}"):
- Name: ${character.name}
- Description: ${character.description || 'N/A'}
- Personality: ${character.personality || 'N/A'}`;
      }

      if (Array.isArray(lorebookEntries) && lorebookEntries.length > 0) {
        const entries = lorebookEntries
          .map((e: { comment?: string; keys?: string[] }) =>
            `- ${e.comment || '(unnamed)'}: [${(e.keys || []).join(', ')}]`)
          .join('\n');
        contextBlock += isRu
          ? `\n\nЗаписи лорбука (используй для соответствия миру):\n${entries}`
          : `\n\nWorld/Lorebook entries (use these to stay consistent with the world):\n${entries}`;
      }
    }

    const genderHint = isRu
      ? (user?.name
          ? `Определи грамматический род {{user}} по имени игрока "${user.name}". `
          : 'По умолчанию используй мужской грамматический род для {{user}}. ')
      : (user?.name
          ? `Determine {{user}}'s grammatical gender from the player name "${user.name}". `
          : 'Default to masculine grammatical gender for {{user}}. ');

    const userPrompt = isRu
      ? `Создай детальный ролевой сценарий на основе концепции: ${concept}
${contextBlock}

Верни JSON-объект с такими полями:
{
  "name": "Короткое, ёмкое название сценария",
  "content": "Подробный текст сценария, описывающий СИТУАЦИЮ (3-5 абзацев): место действия, обстоятельства, что происходит, почему {{user}} и {{char}} здесь, какой конфликт или напряжение существует. НЕ описывай кто такой {{char}} — только что {{char}} ДЕЛАЕТ в сцене. Пример: '{{user}} заходит в старую таверну на окраине города. За стойкой {{char}} протирает бокалы, бросая настороженные взгляды на дверь...' — используй {{user}} и {{char}} буквально.",
  "tags": ["тег1", "тег2", "тег3"]
}

ПРАВИЛА:
1. Пиши {{user}} и {{char}} как буквальные шаблонные плейсхолдеры — они будут заменены при выполнении
2. НИКОГДА не заменяй {{user}} или {{char}} настоящими именами, местоимениями вроде "вы/ты" или словами "пользователь/персонаж"
3. НЕ описывай внешность, характер, предысторию или роль {{char}} — это уже есть в карточке персонажа. Описывай только что {{char}} ДЕЛАЕТ в сцене
4. ${genderHint}Используй соответствующие русские грамматические окончания для {{user}} (например: "{{user}} подошёл" для мужского, "{{user}} подошла" для женского)
5. Пиши на русском. Будь креативен и конкретен.${character?.name ? ' Сценарий должен подходить этому персонажу.' : ''}`
      : `Create a detailed roleplay scenario based on this concept: ${concept}
${contextBlock}

Return a JSON object with these fields:
{
  "name": "Short, evocative scenario title",
  "content": "Detailed scenario text describing the SITUATION (3-5 paragraphs): location, circumstances, what is happening, why {{user}} and {{char}} are here, what tension or conflict exists. Do NOT describe who {{char}} is — only what {{char}} is doing. Use {{user}} and {{char}} literally.",
  "tags": ["tag1", "tag2", "tag3"]
}

RULES:
1. Write {{user}} and {{char}} as literal template placeholders — they will be substituted at runtime
2. NEVER replace {{user}} or {{char}} with actual names, pronouns, or "user/character"
3. Do NOT describe {{char}}'s appearance, personality, backstory, or role — that is already in the character card. Only describe what {{char}} is DOING in the scene
4. ${genderHint}Use appropriate grammatical endings for {{user}}
5. Write in English. Be creative and specific.${character?.name ? ' The scenario should fit this character.' : ''}`;

    console.log('[scenario] Step 2: generating scenario (brief=%s)...', !!brief);
    console.log('[scenario] Step 2 system prompt:\n%s', systemPrompt);
    console.log('[scenario] Step 2 user prompt:\n%s', userPrompt);
    const raw = await callLlm(apiServer, systemPrompt, userPrompt, { maxTokens: 2048 });
    const scenario = extractJson(raw) as Record<string, unknown>;

    for (const field of ['name', 'content']) {
      if (!scenario[field]) scenario[field] = '';
    }
    if (!Array.isArray(scenario.tags)) scenario.tags = [];

    // Post-process: replace real names (including declined forms) back to {{char}}/{{user}}
    const charName = character?.name?.trim();
    const userName = user?.name?.trim();
    if (charName || userName) {
      scenario.content = replaceNamesWithPlaceholders(
        String(scenario.content || ''), charName, userName,
      );
    }

    res.json(scenario);
  } catch (err) {
    console.error('[ai-generation/scenario]', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/ai-generation/first-message ────────────────────────────────────

router.post('/first-message', async (req, res) => {
  try {
    const { character, scenario, user, language } = req.body;
    if (!character?.name)
      return res.status(400).json({ error: 'character with name is required' });

    const apiServer = getApiServer();
    const isRu = language !== 'en';

    const genderHint = isRu
      ? (user?.name
          ? `Определи грамматический род {{user}} по имени игрока "${user.name}". `
          : 'По умолчанию используй мужской грамматический род для {{user}}. ')
      : (user?.name
          ? `Determine {{user}}'s grammatical gender from the player name "${user.name}". `
          : 'Default to masculine grammatical gender for {{user}}. ');

    const systemPrompt = isRu
      ? `Ты — помощник для ролевых игр. Сгенерируй вступительное сообщение от лица {{char}} для начала ролевой сцены.
ОБЯЗАТЕЛЬНО: Используй буквальные плейсхолдеры {{user}} и {{char}} — НИКОГДА не подставляй настоящие имена.
Возвращай ТОЛЬКО текст сообщения, без JSON, без названий полей, без лишнего форматирования.`
      : `You are a creative writing assistant for roleplay. Generate an opening message from {{char}}'s perspective to start a roleplay scene.
MANDATORY: Use the literal placeholders {{user}} and {{char}} — NEVER substitute real names.
Return ONLY the message text, no JSON, no field names, no extra formatting.`;

    let contextBlock = isRu
      ? `Имя персонажа (пиши {{char}} в тексте): ${character.name}`
      : `Character name (write {{char}} in output): ${character.name}`;
    if (character.description) contextBlock += `\n${isRu ? 'Описание' : 'Description'}: ${character.description}`;
    if (character.personality) contextBlock += `\n${isRu ? 'Характер' : 'Personality'}: ${character.personality}`;
    if (scenario) contextBlock += `\n\n${isRu ? 'Сценарий' : 'Scenario'}:\n${scenario}`;
    if (user?.name) contextBlock += `\n\n${isRu ? 'Имя игрока (пиши {{user}} в тексте)' : 'Player name (write {{user}} in output)'}: ${user.name}`;
    if (user?.persona) contextBlock += `\n${isRu ? 'Персона игрока' : 'Player persona'}: ${user.persona}`;

    const userPrompt = isRu
      ? `${contextBlock}

Напиши вступительное ролевое сообщение от лица {{char}}. Включи действия {{char}} (в *звёздочках*) и при желании речь. Задай сцену и пригласи к взаимодействию.

${genderHint}Используй соответствующие русские грамматические окончания. Пиши на русском.
Используй {{user}} и {{char}} как буквальные плейсхолдеры — они будут заменены при выполнении.`
      : `${contextBlock}

Write an opening roleplay message from {{char}}'s perspective. Include {{char}}'s actions (in *asterisks*) and optionally speech. Set the scene and invite interaction.

${genderHint}Use appropriate English grammatical forms. Write in English.
Use {{user}} and {{char}} as literal placeholders — they will be substituted at runtime.`;

    const raw = await callLlm(apiServer, systemPrompt, userPrompt, { maxTokens: 512 });
    let firstMes = raw.trim();

    // Post-process: replace real names with placeholders
    const charName = character.name?.trim();
    const userName = user?.name?.trim();
    if (charName || userName) {
      firstMes = replaceNamesWithPlaceholders(firstMes, charName, userName);
    }

    res.json({ first_mes: firstMes });
  } catch (err) {
    console.error('[ai-generation/first-message]', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
