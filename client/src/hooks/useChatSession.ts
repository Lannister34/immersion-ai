import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as api from '@/api';
import { stripThinkBlocks } from '@/lib/messageFormatting';
import { computeBaseSystemPrompt } from '@/lib/promptBuilder';
import { getEffectiveSamplerSettings, useAppStore } from '@/stores';
import type {
  Character,
  ChatHeader,
  ChatLine,
  ChatMessage,
  ChatMetadata,
  SamplerSettings,
  Scenario,
  WorldInfo,
  WorldInfoEntry,
} from '@/types';

// ── Hook Return Type ────────────────────────────────────────────────────────

interface UseChatSessionReturn {
  // Data
  character: Character | null;
  lorebook: WorldInfo | null;
  activeScenario: Scenario | null;
  messages: ChatMessage[];
  lastPromptLength: number;
  error: string;

  // Setters (needed by generation hook)
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setError: React.Dispatch<React.SetStateAction<string>>;

  // Actions
  buildChatData: (msgs: ChatMessage[]) => {
    prompt: string;
    messages: Array<{ role: string; content: string }>;
  };
  buildChatForSave: (msgs: ChatMessage[]) => ChatLine[];
  updateSessionMeta: (msgs: ChatMessage[]) => void;
  maybeGenerateTitle: (msgs: ChatMessage[]) => void;
  handleSettingsChanged: () => void;

  // Refs
  fullPromptLengthRef: React.RefObject<number>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useChatSession(chatId: string | undefined): UseChatSessionReturn {
  const navigate = useNavigate();
  const { upsertChatSession, connection, chatSessions } = useAppStore();

  // Look up the session by chatId (which is the chatFile / timestamp)
  const session = chatSessions.find((s) => s.chatFile === chatId);
  const characterAvatar = session?.characterAvatar ?? null;
  const chatFile = chatId ?? null;
  const activeChat = characterAvatar && chatFile ? { characterAvatar, chatFile } : null;

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastPromptLength, setLastPromptLength] = useState(0);
  const [error, setError] = useState('');
  const [character, setCharacter] = useState<Character | null>(null);
  const [lorebook, setLorebook] = useState<WorldInfo | null>(null);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);

  // Refs
  const chatHeaderRef = useRef<ChatHeader | null>(null);
  const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullPromptLengthRef = useRef(0);

  // Stable refs for values that should NOT trigger loadChat re-creation
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // ── Load chat data ──────────────────────────────────────────────────────

  const loadChat = useCallback(async () => {
    if (!characterAvatar || !chatFile) return;
    const { removeChatSession, upsertChatSession, getChatSession } = useAppStore.getState();
    const conn = connectionRef.current;
    const nav = navigateRef.current;
    const isEmptyChar = characterAvatar === '_no_character_';

    try {
      let char: Character | null = null;
      if (isEmptyChar) {
        char = {
          name: '',
          description: '',
          personality: '',
          mes_example: '',
          tags: [],
        };
      } else {
        char = await api.getCharacterByAvatar(characterAvatar);
        if (!char) {
          removeChatSession(characterAvatar, chatFile);
          nav('/chat', { replace: true });
          return;
        }
      }
      setCharacter(char);

      if (char.world) {
        try {
          const wb = await api.getWorldInfo(char.world);
          setLorebook(wb);
        } catch {
          setLorebook(null);
        }
      } else {
        setLorebook(null);
      }

      // Update chat session metadata
      const model = conn.connected ? conn.model : undefined;
      upsertChatSession({
        characterAvatar,
        characterName: char.name,
        chatFile,
        model,
        createdAt: getChatSession(characterAvatar, chatFile)?.createdAt ?? new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      });

      const chatData = await api.getChatMessages(characterAvatar, chatFile);
      const header = chatData.find((m): m is ChatHeader => 'chat_metadata' in m);
      if (header) chatHeaderRef.current = header;
      const msgs = chatData.filter((m): m is ChatMessage => !('chat_metadata' in m) && 'mes' in m);
      setMessages(msgs);

      // Restore per-chat sampler overrides from chat file metadata
      const chatMeta = (header?.chat_metadata ?? {}) as Record<string, unknown>;
      const savedOverrides = chatMeta.customSamplerSettings as Partial<SamplerSettings> | undefined;
      const savedSystemPrompt = chatMeta.customSystemPrompt as string | undefined;

      // Update session with message count/preview + overrides from file
      const existingSession = getChatSession(characterAvatar, chatFile);
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        upsertChatSession({
          characterAvatar,
          characterName: char?.name ?? '',
          chatFile,
          createdAt: existingSession?.createdAt ?? new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          messageCount: msgs.length,
          lastMessagePreview: lastMsg.mes.slice(0, 120),
          title: existingSession?.title,
          customSamplerSettings: savedOverrides,
          customSystemPrompt: savedSystemPrompt,
        });

        // Generate title for existing chats that don't have one yet
        if (!existingSession?.title && msgs.some((m) => !m.is_user && !m.is_system) && char) {
          try {
            const title = await api.generateChatTitle(
              msgs
                .filter((m) => !m.is_system)
                .map((m) => ({
                  name: m.name,
                  mes: m.is_user ? m.mes : stripThinkBlocks(m.mes),
                })),
              char.name,
            );
            if (title) {
              const current = getChatSession(characterAvatar, chatFile);
              if (current && !current.title) {
                useAppStore.getState().upsertChatSession({ ...current, title });
              }
            }
          } catch {
            // silently ignore title generation errors
          }
        }
      } else if (existingSession) {
        upsertChatSession({
          ...existingSession,
          messageCount: 0,
          lastMessagePreview: undefined,
          lastActiveAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(err);
      setError('Произошла ошибка. Попробуйте ещё раз.');
    }
  }, [characterAvatar, chatFile]);

  // Load chat when route params change
  useEffect(() => {
    if (!characterAvatar || !chatFile) return;
    loadChat();
  }, [loadChat, characterAvatar, chatFile]);

  // ── Load active scenario ────────────────────────────────────────────────

  const activeScenarioName = session?.activeScenarioName;
  useEffect(() => {
    if (!activeScenarioName) {
      setActiveScenario(null);
      return;
    }
    const load = async () => {
      try {
        const scenario = await api.getScenario(activeScenarioName);
        setActiveScenario(scenario);
      } catch {
        setActiveScenario(null);
      }
    };
    load();
  }, [activeScenarioName]);

  // ── Build chat data (prompt + messages for API) ─────────────────────────

  const buildChatData = useCallback(
    (
      msgs: ChatMessage[],
    ): {
      prompt: string;
      messages: Array<{ role: string; content: string }>;
    } => {
      if (!character) return { prompt: '', messages: [] };
      const { responseLanguage, thinkingEnabled, getChatSession } = useAppStore.getState();

      // Merge per-chat character overrides
      const sessionOverrides = chatFile
        ? getChatSession(character.avatar ?? '', chatFile)?.characterOverrides
        : undefined;
      const ch = sessionOverrides ? { ...character, ...sessionOverrides } : character;

      // Check for per-chat system prompt override
      const sessionMeta = chatFile ? getChatSession(character.avatar ?? '', chatFile) : undefined;
      let systemText: string;
      if (sessionMeta?.customSystemPrompt != null) {
        systemText = sessionMeta.customSystemPrompt;
      } else {
        systemText = computeBaseSystemPrompt(character, sessionOverrides, activeScenario);
      }

      // Append language enforcement
      if (responseLanguage === 'ru') {
        systemText += '\n\n[Пиши только на русском языке. Не переключайся на английский.]';
      } else if (responseLanguage === 'en') {
        systemText += '\n\n[Write only in English. Do not switch to other languages.]';
      }

      // Merge world info into system text
      if (lorebook?.entries) {
        const chatText = msgs
          .map((m) => m.mes)
          .join('\n')
          .toLowerCase();
        const matchedEntries: WorldInfoEntry[] = [];
        for (const entry of Object.values(lorebook.entries)) {
          if (entry.disable) continue;
          const primaryMatch = entry.key.some((k) => k && chatText.includes(k.toLowerCase()));
          const secondaryMatch =
            !entry.selective ||
            entry.keysecondary.length === 0 ||
            entry.keysecondary.some((k) => k && chatText.includes(k.toLowerCase()));
          if (entry.constant || (primaryMatch && secondaryMatch)) {
            matchedEntries.push(entry);
          }
        }
        if (matchedEntries.length > 0) {
          matchedEntries.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
          const loreText = matchedEntries.map((e) => e.content).join('\n');
          systemText += `\n\n[World Info]\n${loreText}`;
        }
      }

      // Build structured messages array
      const chatMessages: Array<{ role: string; content: string }> = [];
      chatMessages.push({ role: 'system', content: systemText });

      // Message examples
      if (ch.mes_example) {
        const examples = ch.mes_example.split('<START>').filter(Boolean);
        for (const example of examples) {
          const lines = example.trim().split('\n');
          for (const line of lines) {
            const userMatch = line.match(/^{{user}}: (.+)/);
            const charMatch = line.match(/^{{char}}: (.+)/);
            if (userMatch) chatMessages.push({ role: 'user', content: userMatch[1] });
            else if (charMatch) chatMessages.push({ role: 'assistant', content: charMatch[1] });
          }
        }
      }

      // Context window management
      const samplers = getEffectiveSamplerSettings(useAppStore.getState(), chatFile ?? undefined);
      const contextSize = useAppStore.getState().llmServerConfig.contextSize;
      const maxTokens = Math.max(contextSize - samplers.max_length, Math.floor(contextSize * 0.25));
      const preambleLength = chatMessages.reduce((sum, m) => sum + m.content.length, 0);
      const preambleTokens = Math.round(preambleLength / 3.5);

      // Build chat message entries (strip think blocks from assistant msgs to save context)
      const chatEntries = msgs
        .filter((m) => !m.is_system)
        .map((m) => ({
          role: m.is_user ? 'user' : 'assistant',
          content: m.is_user ? m.mes : stripThinkBlocks(m.mes),
        }));

      const allEntriesLength = chatEntries.reduce((sum, m) => sum + m.content.length, 0);

      // Trim chat entries to fit context window
      const tokenBudget = maxTokens - preambleTokens - 20;
      const estimateTokens = (text: string): number => Math.round(text.length / 3.5);
      const includedEntries: Array<{ role: string; content: string }> = [];

      if (samplers.context_trim_strategy === 'trim_middle') {
        const headBudget = Math.floor(tokenBudget * 0.25);
        let headTokens = 0;
        let headEnd = 0;
        for (let i = 0; i < chatEntries.length; i++) {
          const t = estimateTokens(chatEntries[i].content);
          if (headTokens + t > headBudget) break;
          headTokens += t;
          headEnd = i + 1;
        }
        let tailBudget = tokenBudget - headTokens;
        let tailStart = chatEntries.length;
        for (let i = chatEntries.length - 1; i >= headEnd; i--) {
          const t = estimateTokens(chatEntries[i].content);
          if (tailBudget - t < 0) break;
          tailBudget -= t;
          tailStart = i;
        }
        includedEntries.push(...chatEntries.slice(0, headEnd), ...chatEntries.slice(tailStart));
      } else {
        let remaining = tokenBudget;
        for (let i = chatEntries.length - 1; i >= 0; i--) {
          const entryTokens = estimateTokens(chatEntries[i].content);
          if (remaining - entryTokens < 0) break;
          includedEntries.unshift(chatEntries[i]);
          remaining -= entryTokens;
        }
      }

      chatMessages.push(...includedEntries);

      // Build raw ChatML prompt (for fallback / context indicator)
      let prompt = '';
      for (const m of chatMessages) {
        prompt += `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`;
      }
      prompt += '<|im_start|>assistant\n';

      if (!thinkingEnabled) {
        prompt += '<think>\n</think>\n\n';
      }

      // Store full (untruncated) prompt length for context indicator
      const includedLength = includedEntries.reduce((sum, m) => sum + m.content.length, 0);
      fullPromptLengthRef.current = preambleLength + allEntriesLength + (allEntriesLength - includedLength);

      return { prompt, messages: chatMessages };
    },
    [character, lorebook, chatFile, activeScenario],
  );

  // ── Prompt length estimation ────────────────────────────────────────────

  useEffect(() => {
    if (!character || messages.length === 0) {
      setLastPromptLength(0);
      return;
    }
    buildChatData(messages); // triggers fullPromptLengthRef update
    setLastPromptLength(fullPromptLengthRef.current);
  }, [messages, character, buildChatData]);

  // ── Build chat for save ─────────────────────────────────────────────────

  const buildChatForSave = useCallback(
    (msgs: ChatMessage[]): ChatLine[] => {
      const header = chatHeaderRef.current ?? {
        chat_metadata: {},
        user_name: '',
        character_name: character?.name ?? '',
      };
      // Persist per-chat sampler overrides inside the chat file
      const sess = activeChat
        ? useAppStore.getState().getChatSession(activeChat.characterAvatar, activeChat.chatFile)
        : null;
      const metadata: ChatMetadata = { ...(header.chat_metadata ?? {}) };
      if (sess?.customSamplerSettings && Object.keys(sess.customSamplerSettings).length > 0) {
        metadata.customSamplerSettings = sess.customSamplerSettings;
      } else {
        delete metadata.customSamplerSettings;
      }
      if (sess?.customSystemPrompt != null) {
        metadata.customSystemPrompt = sess.customSystemPrompt;
      } else {
        delete metadata.customSystemPrompt;
      }
      const updatedHeader = { ...header, chat_metadata: metadata };
      chatHeaderRef.current = updatedHeader;
      return [updatedHeader, ...msgs];
    },
    [character, activeChat],
  );

  // ── Update session metadata ─────────────────────────────────────────────

  const updateSessionMeta = useCallback(
    (msgs: ChatMessage[]) => {
      if (!activeChat || !character) return;
      const lastMsg = msgs[msgs.length - 1];
      const existing = useAppStore.getState().getChatSession(activeChat.characterAvatar, activeChat.chatFile);
      upsertChatSession({
        characterAvatar: activeChat.characterAvatar,
        characterName: character.name,
        chatFile: activeChat.chatFile,
        model: connectionRef.current.connected ? connectionRef.current.model : undefined,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        messageCount: msgs.length,
        lastMessagePreview: lastMsg?.mes.slice(0, 120),
        title: existing?.title,
      });
    },
    [activeChat, character, upsertChatSession],
  );

  // ── Title generation ────────────────────────────────────────────────────

  const maybeGenerateTitle = useCallback(
    (msgs: ChatMessage[]) => {
      if (!activeChat || !character) return;
      const sess = useAppStore.getState().getChatSession(activeChat.characterAvatar, activeChat.chatFile);
      if (sess?.title) return;
      const hasAssistantMsg = msgs.some((m) => !m.is_user && !m.is_system);
      if (!hasAssistantMsg) return;

      // Fire and forget — async IIFE to use await
      (async () => {
        try {
          const title = await api.generateChatTitle(
            msgs
              .filter((m) => !m.is_system)
              .map((m) => ({
                name: m.name,
                mes: m.is_user ? m.mes : stripThinkBlocks(m.mes),
              })),
            character.name,
          );
          if (title) {
            const current = useAppStore.getState().getChatSession(activeChat.characterAvatar, activeChat.chatFile);
            if (current && !current.title) {
              useAppStore.getState().upsertChatSession({ ...current, title });
            }
          }
        } catch {
          // silently ignore title generation errors
        }
      })();
    },
    [activeChat, character],
  );

  // ── Settings save (debounced) ───────────────────────────────────────────

  const handleSettingsChanged = useCallback(() => {
    if (settingsSaveTimerRef.current) clearTimeout(settingsSaveTimerRef.current);
    settingsSaveTimerRef.current = setTimeout(async () => {
      if (activeChat) {
        try {
          const currentMessages = useAppStore.getState().chatSessions.length > 0 ? messages : [];
          await api.saveChat(activeChat.characterAvatar, activeChat.chatFile, buildChatForSave(currentMessages));
        } catch (err) {
          console.warn('Failed to save chat settings:', err);
        }
      }
    }, 500);
  }, [activeChat, messages, buildChatForSave]);

  return {
    character,
    lorebook,
    activeScenario,
    messages,
    lastPromptLength,
    error,
    setMessages,
    setError,
    buildChatData,
    buildChatForSave,
    updateSessionMeta,
    maybeGenerateTitle,
    handleSettingsChanged,
    fullPromptLengthRef,
  };
}
