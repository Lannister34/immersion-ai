import { useCallback, useEffect, useRef, useState } from 'react';

import * as api from '@/api';
import { stripThinkBlocks } from '@/lib/messageFormatting';
import { getActiveConnectionPreset, getEffectiveSamplerSettings, useAppStore } from '@/stores';
import type { ChatMessage } from '@/types';

// ── Types ───────────────────────────────────────────────────────────────────

interface UseChatGenerationParams {
  character: { name: string; avatar?: string } | null;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  buildChatData: (msgs: ChatMessage[]) => {
    prompt: string;
    messages: Array<{ role: string; content: string }>;
  };
  buildChatForSave: (msgs: ChatMessage[]) => Record<string, unknown>[];
  updateSessionMeta: (msgs: ChatMessage[]) => void;
  maybeGenerateTitle: (msgs: ChatMessage[]) => void;
  shouldAutoScroll: React.RefObject<boolean>;
  activeChat: { characterAvatar: string; chatFile: string } | null;
  chatFile: string | null;
}

interface UseChatGenerationReturn {
  isGenerating: boolean;
  streamText: string;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  handleSend: () => void;
  handleGenerate: () => void;
  handleRegenerate: () => void;
  handleStop: () => void;
  handleEditMessage: (index: number, newText: string) => Promise<void>;
  handleDeleteMessage: (index: number) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useChatGeneration({
  character,
  messages,
  setMessages,
  setError,
  buildChatData,
  buildChatForSave,
  updateSessionMeta,
  maybeGenerateTitle,
  shouldAutoScroll,
  activeChat,
  chatFile,
}: UseChatGenerationParams): UseChatGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [input, setInput] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const lastAbortTime = useRef<number>(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Stable refs for values that change but shouldn't cause useCallback recreation
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const isGeneratingRef = useRef(isGenerating);
  isGeneratingRef.current = isGenerating;
  const characterRef = useRef(character);
  characterRef.current = character;
  const activeChatRef = useRef(activeChat);
  activeChatRef.current = activeChat;
  const chatFileRef = useRef(chatFile);
  chatFileRef.current = chatFile;
  const buildChatDataRef = useRef(buildChatData);
  buildChatDataRef.current = buildChatData;
  const buildChatForSaveRef = useRef(buildChatForSave);
  buildChatForSaveRef.current = buildChatForSave;
  const updateSessionMetaRef = useRef(updateSessionMeta);
  updateSessionMetaRef.current = updateSessionMeta;
  const maybeGenerateTitleRef = useRef(maybeGenerateTitle);
  maybeGenerateTitleRef.current = maybeGenerateTitle;
  const setMessagesRef = useRef(setMessages);
  setMessagesRef.current = setMessages;
  const setErrorRef = useRef(setError);
  setErrorRef.current = setError;

  // Focus input when generation completes
  useEffect(() => {
    if (!isGenerating) {
      inputRef.current?.focus();
    }
  }, [isGenerating]);

  // ── Core generation logic ─────────────────────────────────────────────

  /** Wait if a generation was recently aborted so KoboldCpp can finish cleanup */
  const waitAfterAbort = async (): Promise<void> => {
    const elapsed = Date.now() - lastAbortTime.current;
    if (elapsed < 1000) {
      await new Promise((r) => setTimeout(r, 1000 - elapsed));
    }
  };

  /**
   * Wraps a generation function with common setup/teardown (error handling, state reset).
   * Eliminates duplicated try/catch/finally in handleSend/handleGenerate/handleRegenerate.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: all state accessed via stable refs
  const withGenerationGuard = useCallback(async (fn: () => Promise<void>): Promise<void> => {
    setErrorRef.current('');
    shouldAutoScroll.current = true;
    setIsGenerating(true);
    setStreamText('');
    try {
      await fn();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error(err);
        setErrorRef.current('Произошла ошибка. Попробуйте ещё раз.');
      }
    } finally {
      setIsGenerating(false);
      setStreamText('');
      abortRef.current = null;
    }
  }, []);

  /**
   * Core generation logic shared by handleSend, handleGenerate, and handleRegenerate.
   * Takes the messages to use as context, generates an assistant reply, saves, and updates state.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: all state accessed via stable refs
  const runGeneration = useCallback(
    async (msgsForGeneration: ChatMessage[], opts?: { generateTitle?: boolean; preSave?: boolean }): Promise<void> => {
      const chat = activeChatRef.current;
      const char = characterRef.current;
      if (!chat || !char) return;

      await waitAfterAbort();

      if (opts?.preSave) {
        await api.saveChat(chat.characterAvatar, chat.chatFile, buildChatForSaveRef.current(msgsForGeneration));
      }

      const { messages: chatCompletionMessages } = buildChatDataRef.current(msgsForGeneration);
      const state = useAppStore.getState();
      const { thinkingEnabled, backendMode, llmServerConfig, streamingEnabled } = state;
      const preset = getActiveConnectionPreset(state);
      const apiServer = backendMode === 'builtin' ? `http://127.0.0.1:${llmServerConfig.port}` : preset.url;

      abortRef.current = new AbortController();
      const samplers = getEffectiveSamplerSettings(useAppStore.getState(), chatFileRef.current ?? undefined);

      const generatedText = await api.generateTextStream(
        {
          api_server: apiServer,
          api_key: preset.apiKey,
          messages: chatCompletionMessages,
          chat_template_kwargs: { enable_thinking: thinkingEnabled },
          max_length: samplers.max_length,
          max_context_length: llmServerConfig.contextSize,
          temperature: samplers.temperature,
          top_p: samplers.top_p,
          top_k: samplers.top_k,
          min_p: samplers.min_p,
          rep_pen: samplers.rep_pen,
          rep_pen_range: samplers.rep_pen_range,
          presence_penalty: samplers.presence_penalty,
        },
        streamingEnabled ? (text) => setStreamText(text) : () => {},
        abortRef.current.signal,
        streamingEnabled,
      );

      const assistantMessage: ChatMessage = {
        name: char.name,
        is_user: false,
        mes: stripThinkBlocks(generatedText),
        send_date: new Date().toISOString(),
        extra: {},
      };

      const finalMessages = [...msgsForGeneration, assistantMessage];
      setMessagesRef.current(finalMessages);
      setErrorRef.current('');

      try {
        await api.saveChat(chat.characterAvatar, chat.chatFile, buildChatForSaveRef.current(finalMessages));
        updateSessionMetaRef.current(finalMessages);
        if (opts?.generateTitle) maybeGenerateTitleRef.current(finalMessages);
      } catch (saveErr) {
        console.error('Failed to save chat:', saveErr);
      }
    },
    [],
  );

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    if (!input.trim() || !activeChatRef.current || !characterRef.current || isGeneratingRef.current) return;
    const conn = useAppStore.getState().connection;
    if (!conn.connected) return;

    const userMessage: ChatMessage = {
      name: useAppStore.getState().userName || 'User',
      is_user: true,
      mes: input.trim(),
      send_date: new Date().toISOString(),
      extra: {},
    };

    const updatedMessages = [...messagesRef.current, userMessage];
    setMessagesRef.current(updatedMessages);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    withGenerationGuard(() => runGeneration(updatedMessages, { preSave: true, generateTitle: true }));
  }, [input, withGenerationGuard, runGeneration]);

  const handleGenerate = useCallback(() => {
    if (messagesRef.current.length === 0 || isGeneratingRef.current || !activeChatRef.current || !characterRef.current)
      return;
    const conn = useAppStore.getState().connection;
    if (!conn.connected) return;
    const lastMsg = messagesRef.current[messagesRef.current.length - 1];
    if (lastMsg && !lastMsg.is_user && !lastMsg.is_system) return;

    withGenerationGuard(() => runGeneration(messagesRef.current, { generateTitle: true }));
  }, [withGenerationGuard, runGeneration]);

  const handleRegenerate = useCallback(() => {
    if (messagesRef.current.length === 0 || isGeneratingRef.current || !activeChatRef.current || !characterRef.current)
      return;
    const conn = useAppStore.getState().connection;
    if (!conn.connected) return;
    const lastMsg = messagesRef.current[messagesRef.current.length - 1];
    if (!lastMsg || lastMsg.is_user) return;

    const withoutLast = messagesRef.current.slice(0, -1);
    setMessagesRef.current(withoutLast);

    withGenerationGuard(() => runGeneration(withoutLast, { preSave: true }));
  }, [withGenerationGuard, runGeneration]);

  const handleStop = useCallback(async () => {
    lastAbortTime.current = Date.now();
    try {
      await api.abortGeneration();
    } catch {
      // ignore — best effort
    }
    abortRef.current?.abort();
  }, []);

  const handleEditMessage = useCallback(async (index: number, newText: string) => {
    if (!newText || index < 0 || index >= messagesRef.current.length || isGeneratingRef.current) return;
    const updated = [...messagesRef.current];
    updated[index] = { ...updated[index], mes: newText };
    setMessagesRef.current(updated);
    const chat = activeChatRef.current;
    if (chat) {
      await api.saveChat(chat.characterAvatar, chat.chatFile, buildChatForSaveRef.current(updated));
      updateSessionMetaRef.current(updated);
    }
  }, []);

  const handleDeleteMessage = useCallback(async (index: number) => {
    if (index < 0 || index >= messagesRef.current.length || isGeneratingRef.current) return;
    const updated = messagesRef.current.filter((_, i) => i !== index);
    setMessagesRef.current(updated);
    const chat = activeChatRef.current;
    if (chat) {
      await api.saveChat(chat.characterAvatar, chat.chatFile, buildChatForSaveRef.current(updated));
      updateSessionMetaRef.current(updated);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Ctrl+R hotkey ─────────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        if (isGeneratingRef.current || messagesRef.current.length === 0) return;
        const lastMsg = messagesRef.current[messagesRef.current.length - 1];
        if (lastMsg?.is_user) {
          handleGenerate();
        } else if (lastMsg && !lastMsg.is_user && !lastMsg.is_system) {
          handleRegenerate();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleGenerate, handleRegenerate]);

  return {
    isGenerating,
    streamText,
    input,
    setInput,
    handleSend,
    handleGenerate,
    handleRegenerate,
    handleStop,
    handleEditMessage,
    handleDeleteMessage,
    handleKeyDown,
    inputRef,
  };
}
