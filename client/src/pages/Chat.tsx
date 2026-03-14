import { clsx } from 'clsx';
import { AlertTriangle, ArrowLeft, Loader2, Menu, RotateCcw, Send, Sliders, Square } from 'lucide-react';
import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatList, ChatSettingsPanel, ContextIndicator, GenerationTimer, MessageBubble } from '@/components/chat';
import { Button } from '@/components/ui/Button';
import { useAutoScroll, useChatGeneration, useChatSession } from '@/hooks';
import { formatMessageContent } from '@/lib/messageFormatting';
import { useAppStore } from '@/stores';

// ── Active Chat View ────────────────────────────────────────────────────────

export function ActiveChatView(): JSX.Element | null {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { connection, chatSessions, sidebarCollapsed, toggleSidebar } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const session = chatSessions.find((s) => s.chatFile === chatId);
  const activeChat =
    session?.characterAvatar && chatId ? { characterAvatar: session.characterAvatar, chatFile: chatId } : null;

  // Refs for scroll container
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // Session data (character, messages, lorebook, etc.)
  const chatSession = useChatSession(chatId);
  const { character, messages, error, lastPromptLength, activeScenario, handleSettingsChanged } = chatSession;

  // Generation logic (send, generate, regenerate, stop)
  const {
    isGenerating,
    streamText,
    input,
    setInput,
    inputRef,
    handleSend,
    handleGenerate,
    handleRegenerate,
    handleStop,
    handleEditMessage,
    handleDeleteMessage,
    handleKeyDown,
  } = useChatGeneration({
    ...chatSession,
    shouldAutoScroll,
    activeChat: activeChat ?? null,
    chatFile: chatId ?? null,
  });

  // Auto-scroll
  const { handleScroll } = useAutoScroll(messagesEndRef, messagesContainerRef, shouldAutoScroll, {
    messageCount: messages.length,
    streamText,
  });

  // Redirect to chat list if session not found
  useEffect(() => {
    if (chatId && !activeChat) {
      navigate('/chat', { replace: true });
    }
  }, [chatId, activeChat, navigate]);

  if (!activeChat) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-x-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0 sticky top-0 z-10">
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer md:hidden"
          >
            <Menu size={16} />
          </button>
        )}
        <button
          onClick={() => navigate('/chat')}
          className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
        {character?.avatar && (
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[var(--color-border)]">
            <img src={`/characters/${character.avatar}`} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text)] truncate">{character?.name ?? 'Chat'}</div>
          <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-2 min-w-0 overflow-hidden">
            <span className="flex-shrink-0">
              {messages.length} {messages.length === 1 ? 'сообщение' : messages.length < 5 ? 'сообщения' : 'сообщений'}
            </span>
            <ContextIndicator
              promptLength={lastPromptLength}
              maxContext={useAppStore.getState().llmServerConfig.contextSize}
            />
            <GenerationTimer isGenerating={isGenerating} />
          </div>
        </div>
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className={clsx(
            'p-1.5 rounded-lg transition-colors cursor-pointer',
            settingsOpen
              ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
              : 'hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]',
          )}
          title="Настройки чата"
        >
          <Sliders size={16} />
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left column: messages + input */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Messages */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 sm:py-4"
          >
            <div className="max-w-3xl mx-auto flex flex-col gap-3 sm:gap-4">
              {messages.map((msg, i) => (
                <MessageBubble
                  key={`${msg.send_date}-${i}`}
                  message={msg}
                  characterAvatar={character?.avatar}
                  isLast={i === messages.length - 1}
                  onEdit={(newText) => handleEditMessage(i, newText)}
                  onDelete={() => handleDeleteMessage(i)}
                  onRegenerate={handleRegenerate}
                  isGenerating={isGenerating}
                />
              ))}

              {isGenerating && (
                <div className="flex gap-2 sm:gap-3 max-w-[95%] sm:max-w-[85%]">
                  <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex-shrink-0 overflow-hidden flex items-center justify-center">
                    <Loader2 size={14} className="animate-spin text-[var(--color-primary)]" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md px-4 py-2.5 bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    {streamText ? (
                      <div
                        className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap break-words [overflow-wrap:anywhere] [&_em]:italic [&_strong]:font-bold"
                        dangerouslySetInnerHTML={{
                          __html: formatMessageContent(streamText, true),
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 py-1">
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        />
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 justify-center text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/25 rounded-xl px-4 py-2.5 mx-auto max-w-md">
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Generate button — only when last message is from user (AI reply missing) */}
              {!isGenerating && messages.length > 0 && messages[messages.length - 1]?.is_user && (
                <div className="flex justify-center mt-1">
                  <button
                    onClick={handleGenerate}
                    disabled={!connection.connected}
                    title={!connection.connected ? 'Нет подключения к API' : undefined}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border)]"
                  >
                    <RotateCcw size={13} className="text-[var(--color-primary)]" />
                    <span>Сгенерировать ответ ИИ</span>
                    <span className="opacity-40 ml-1">(Ctrl+R)</span>
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center gap-2 max-w-3xl mx-auto">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={connection.connected ? 'Напишите сообщение...' : 'Нет подключения к API...'}
                rows={1}
                disabled={isGenerating || !connection.connected}
                className="flex-1 min-w-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors resize-none min-h-[42px] max-h-32"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                }}
              />
              <div className="flex gap-1">
                {isGenerating ? (
                  <Button variant="danger" size="sm" onClick={handleStop}>
                    <Square size={14} />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!input.trim() || !connection.connected}
                    title={!connection.connected ? 'Нет подключения к API' : undefined}
                  >
                    <Send size={14} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — per-chat sampler settings */}
        {settingsOpen && (
          <ChatSettingsPanel
            session={session ?? null}
            chatFile={chatId ?? null}
            character={character}
            activeScenario={activeScenario}
            onClose={() => setSettingsOpen(false)}
            onSettingsChanged={handleSettingsChanged}
          />
        )}
      </div>
    </div>
  );
}

// ── Main Chat Page ──────────────────────────────────────────────────────────

export function ChatPage(): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5">
      <ChatList
        onOpenChat={(_avatar, chatFile) => navigate(`/chat/${encodeURIComponent(chatFile)}`)}
        onNewChat={() => navigate('/characters')}
      />
    </div>
  );
}
