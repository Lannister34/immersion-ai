import { clsx } from 'clsx';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Cpu,
  FileText,
  Loader2,
  Menu,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw as Reset,
  RotateCcw,
  Search,
  Send,
  Sliders,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from '@/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  DEFAULT_PROMPTS,
  getBasePreset,
  getDefaultSystemPrompt,
  getEffectiveSamplerSettings,
  useAppStore,
} from '@/stores';
import type {
  Character,
  ChatSessionMeta,
  ContextTrimStrategy,
  SamplerSettings,
  Scenario,
  WorldInfo,
  WorldInfoEntry,
} from '@/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

interface ChatMessage {
  name: string;
  is_user: boolean;
  mes: string;
  send_date: string;
  extra?: Record<string, unknown>;
  is_system?: boolean;
}

function formatMarkdown(text: string, applyColors = false): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  if (applyColors) {
    // Highlight dialogue in bright color while narration stays muted (container default)
    html = highlightDialogue(html);
  }
  html = html.replace(/\n/g, '<br/>');
  return html;
}

/** Parse a dialogue block, alternating between dialogue (bright) and narration (muted).
 *  Russian pattern: «Dialogue, — narration. — More dialogue.»
 *  Transitions happen at: punctuation [,!?.…] followed by space+em-dash+space */
function colorizeDialogueSegments(text: string): string {
  const bright = (s: string) => (s ? `<span class='dlg'>${s}</span>` : '');
  const transitionRegex = /[,!?.…]\s*—\s/g;
  const splits: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = transitionRegex.exec(text)) !== null) {
    splits.push(m.index + 1); // split after the punctuation mark
  }
  if (splits.length === 0) return bright(text); // all dialogue

  const parts: string[] = [];
  let pos = 0;
  let isDialogue = true;
  for (const splitAt of splits) {
    const segment = text.slice(pos, splitAt);
    parts.push(isDialogue ? bright(segment) : segment);
    isDialogue = !isDialogue;
    pos = splitAt;
  }
  const rest = text.slice(pos);
  if (rest) parts.push(isDialogue ? bright(rest) : rest);
  return parts.join('');
}

/** Highlight dialogue segments in bright color within muted-base assistant text */
function highlightDialogue(html: string): string {
  const bright = (s: string) => (s ? `<span class='dlg'>${s}</span>` : '');

  // 1. «Guillemet» blocks — parse internal dialogue/narration alternation
  html = html.replace(/«([^»]+)»/g, (_m, inner: string) => {
    return `«${colorizeDialogueSegments(inner)}»`;
  });

  // 2. "Straight quotes" — entire quoted text is dialogue
  html = html.replace(/"([^"]+)"/g, (_m, inner: string) => bright(`"${inner}"`));
  // 3. "Curly quotes"
  html = html.replace(/\u201c([^\u201d]+)\u201d/g, (_m, inner: string) => bright(`\u201c${inner}\u201d`));

  // 4. Em-dash dialogue at line/paragraph start: — text, — narration.
  html = html.replace(/(^|\n)(—\s)(.+)/gm, (_m, prefix: string, dash: string, rest: string) => {
    return `${prefix}${colorizeDialogueSegments(dash + rest)}`;
  });

  return html;
}

/** Strip <think>...</think> blocks from text, returning only the actual response */
function stripThinkBlocks(text: string): string {
  // Remove complete <think>...</think> blocks
  let result = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  // Remove unclosed <think>... (model stopped mid-think)
  result = result.replace(/<think>[\s\S]*$/g, '');
  return result.trim();
}

/**
 * Parse <think>...</think> blocks from model output and render them
 * as collapsible sections. Handles both complete and streaming (unclosed) blocks.
 */
function formatMessageContent(text: string, isStreaming = false): string {
  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const thinkStart = remaining.indexOf('<think>');
    if (thinkStart === -1) {
      // No more think blocks — format rest as normal text with colors
      parts.push(formatMarkdown(remaining, true));
      break;
    }

    // Text before <think> — with colors
    if (thinkStart > 0) {
      parts.push(formatMarkdown(remaining.slice(0, thinkStart), true));
    }

    const afterTag = remaining.slice(thinkStart + 7); // after "<think>"
    const thinkEnd = afterTag.indexOf('</think>');

    if (thinkEnd === -1) {
      // Unclosed think block (streaming or broken output)
      const thinkContent = formatMarkdown(afterTag.trim());
      if (isStreaming && thinkContent) {
        // Show as open/pulsing block during streaming
        parts.push(
          `<div class="think-block-open"><div class="think-header">💭 Размышления...</div><div class="think-content">${thinkContent}</div></div>`,
        );
      } else if (thinkContent) {
        // Completed message with unclosed think — show as collapsible
        parts.push(
          `<details class="think-block"><summary>💭 Размышления</summary><div class="think-content">${thinkContent}</div></details>`,
        );
      }
      break; // nothing after unclosed block
    }

    // Closed think block — collapsible
    const thinkContent = formatMarkdown(afterTag.slice(0, thinkEnd).trim());
    if (thinkContent) {
      parts.push(
        `<details class="think-block"><summary>💭 Размышления</summary><div class="think-content">${thinkContent}</div></details>`,
      );
    }
    remaining = afterTag.slice(thinkEnd + 8); // after "</think>"
  }

  return parts.join('');
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ч. назад`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} д. назад`;
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Generation Timer ────────────────────────────────────────────────────────

function ContextIndicator({ promptLength, maxContext }: { promptLength: number; maxContext: number }) {
  if (promptLength === 0) return null;

  // Rough estimate: ~3.5 chars per token for mixed Russian/English
  const estimatedTokens = Math.round(promptLength / 3.5);
  const ratio = estimatedTokens / maxContext;
  const percent = Math.round(ratio * 100);
  const isOverflow = ratio > 1;

  const formatTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  const barColor =
    isOverflow || percent > 90
      ? 'bg-[var(--color-danger)]'
      : percent > 70
        ? 'bg-yellow-500'
        : 'bg-[var(--color-primary)]';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] tabular-nums"
      title={`Контекст: ~${estimatedTokens} / ${maxContext} токенов (${percent}%)${isOverflow ? ' — старые сообщения обрезаны' : ''}`}
    >
      <span className="w-14 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden inline-block align-middle">
        <span
          className={`block h-full rounded-full ${barColor} transition-all duration-300`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </span>
      <span className={isOverflow ? 'text-[var(--color-danger)]' : ''}>
        {formatTokens(estimatedTokens)}/{formatTokens(maxContext)}
      </span>
    </span>
  );
}

function GenerationTimer({ isGenerating }: { isGenerating: boolean }) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isGenerating) {
      setSeconds(0);
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isGenerating]);

  if (!isGenerating) return null;

  return <span className="text-[10px] text-[var(--color-text-muted)]/60 tabular-nums">{seconds}с</span>;
}

// ── Message Bubble ──────────────────────────────────────────────────────────

const MessageBubble = memo(function MessageBubble({
  message,
  characterAvatar,
  isLast,
  onEdit,
  onDelete,
  onRegenerate,
  isGenerating,
}: {
  message: ChatMessage;
  characterAvatar?: string;
  isLast: boolean;
  onEdit: (newText: string) => void;
  onDelete: () => void;
  onRegenerate?: () => void;
  isGenerating: boolean;
}) {
  const isUser = message.is_user;
  const isAssistant = !message.is_user && !message.is_system;
  const time = formatTime(message.send_date);
  const words = wordCount(message.mes);

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef(0);

  const startEditing = () => {
    // Save scroll position before React re-render changes DOM height
    const scrollContainer = bubbleRef.current?.closest('.overflow-y-auto');
    savedScrollTopRef.current = scrollContainer?.scrollTop ?? 0;
    setEditText(message.mes);
    setIsEditing(true);
  };

  const restoreScroll = () => {
    requestAnimationFrame(() => {
      const scrollContainer = bubbleRef.current?.closest('.overflow-y-auto');
      if (scrollContainer) {
        scrollContainer.scrollTop = savedScrollTopRef.current;
      }
    });
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditText('');
    restoreScroll();
  };

  const saveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.mes && onEdit) {
      onEdit(trimmed);
    }
    setIsEditing(false);
    setEditText('');
    restoreScroll();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      saveEdit();
    }
  };

  // Auto-resize textarea and focus on edit start
  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus({ preventScroll: true });
      // Auto-size to full content height (no cap — chat container handles scrolling)
      editRef.current.style.height = 'auto';
      editRef.current.style.height = `${editRef.current.scrollHeight}px`;
      editRef.current.style.overflowY = 'hidden';
      // Move cursor to end
      editRef.current.selectionStart = editRef.current.value.length;
      editRef.current.selectionEnd = editRef.current.value.length;
      // Restore scroll position, then ensure Save/Cancel buttons are visible
      const scrollContainer = editRef.current.closest('.overflow-y-auto');
      if (scrollContainer) {
        const newMaxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        // If user was near the bottom before edit (within 200px),
        // snap to new bottom so Save/Cancel buttons stay visible
        if (newMaxScroll - savedScrollTopRef.current < 200) {
          scrollContainer.scrollTop = newMaxScroll;
        } else {
          scrollContainer.scrollTop = savedScrollTopRef.current;
        }
      }
    }
  }, [isEditing]);

  // Auto-resize on text change (capped at 400px, then scroll)
  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  // Memoize expensive HTML formatting — only recompute when message text changes
  const formattedHtml = useMemo(
    () => (message.is_user ? formatMarkdown(message.mes) : formatMessageContent(message.mes)),
    [message.mes, message.is_user],
  );

  return (
    <div ref={bubbleRef} className={clsx('flex flex-col gap-1 group/msg', isUser ? 'items-end' : 'items-start')}>
      <div className={clsx('flex flex-col gap-1', 'max-w-[95%] sm:max-w-[85%]', isEditing && 'w-full')}>
        <div className={clsx('flex gap-2 sm:gap-3', isUser ? 'flex-row-reverse' : '')}>
          {!isUser && (
            <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex-shrink-0 overflow-hidden">
              {characterAvatar ? (
                <img src={`/characters/${characterAvatar}`} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                  AI
                </div>
              )}
            </div>
          )}
          <div
            className={clsx(
              'rounded-2xl px-4 py-2.5 text-sm leading-relaxed relative',
              isUser
                ? 'bg-[var(--color-primary)] text-white rounded-br-md'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] rounded-bl-md border border-[var(--color-border)]',
              isEditing && 'flex-1',
            )}
          >
            {!isUser && <div className="text-xs font-semibold text-[var(--color-primary)] mb-1">{message.name}</div>}

            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={editRef}
                  value={editText}
                  onChange={handleEditChange}
                  onKeyDown={handleEditKeyDown}
                  className={clsx(
                    'w-full resize-none rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]',
                    isUser
                      ? 'bg-white/15 text-white placeholder:text-white/50'
                      : 'bg-[var(--color-background)] text-[var(--color-text)] border border-[var(--color-border)]',
                  )}
                  rows={1}
                />
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={saveEdit}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:brightness-110 transition-all cursor-pointer"
                    title="Сохранить (Ctrl+Enter)"
                  >
                    <Check size={13} />
                    <span>Сохранить</span>
                  </button>
                  <button
                    onClick={cancelEditing}
                    className={clsx(
                      'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
                      isUser
                        ? 'text-white/70 hover:text-white hover:bg-white/10'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]',
                    )}
                    title="Отмена (Esc)"
                  >
                    <X size={13} />
                    <span>Отмена</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="whitespace-pre-wrap break-words overflow-hidden [overflow-wrap:anywhere] [&_em]:italic [&_strong]:font-bold"
                dangerouslySetInnerHTML={{ __html: formattedHtml }}
              />
            )}
          </div>
        </div>
        {/* Timestamp + action buttons — shares width with bubble row */}
        {!isEditing && (
          <div className={clsx('flex items-center px-1', isUser ? 'gap-2' : 'ml-10 sm:ml-12 justify-between')}>
            {time && (
              <span className="text-[10px] text-[var(--color-text-muted)]/50 flex-shrink-0">
                {time}
                {!isUser && words > 0 && ` · ${words} сл.`}
              </span>
            )}
            {!isGenerating && (
              <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5">
                {isAssistant && isLast && onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="p-0.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer transition-colors"
                    title="Перегенерировать (Ctrl+R)"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
                <button
                  onClick={startEditing}
                  className="p-0.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer transition-colors"
                  title="Редактировать"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={onDelete}
                  className="p-0.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] cursor-pointer transition-colors"
                  title="Удалить"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ── Chat List (messenger-style, sorted by last message date) ─────────────────

function ChatListItem({
  session,
  onOpenChat,
  onDelete,
}: {
  session: ChatSessionMeta;
  onOpenChat: (avatar: string, chatFile: string) => void;
  onDelete: (session: ChatSessionMeta) => void;
}) {
  const upsertChatSession = useAppStore((s) => s.upsertChatSession);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(session.title || '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveTitle = () => {
    const trimmed = editValue.trim();
    upsertChatSession({ ...session, title: trimmed || undefined });
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
    }
    if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  const displayTitle = session.title || 'Новый чат';

  return (
    <div
      onClick={() => !editing && onOpenChat(session.characterAvatar, session.chatFile)}
      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--color-surface)] transition-colors cursor-pointer text-left w-full group/chat"
    >
      {/* Avatar with character name below */}
      <div className="flex flex-col items-center flex-shrink-0 w-11">
        <div className="w-11 h-11 rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)]">
          {session.characterAvatar && session.characterAvatar !== '_no_character_' ? (
            <img
              src={`/characters/${session.characterAvatar}`}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MessageCircle size={18} className="text-[var(--color-text-muted)]" />
            </div>
          )}
        </div>
        <span className="text-[9px] text-[var(--color-text-muted)] truncate w-full text-center mt-0.5 leading-tight">
          {session.characterName || 'Свободный чат'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: chat title + time */}
        <div className="flex items-baseline justify-between gap-2">
          {editing ? (
            <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={saveTitle}
                placeholder="Название чата..."
                className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-primary)] rounded px-1.5 py-0.5 text-sm text-[var(--color-text)] outline-none min-w-0"
              />
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  saveTitle();
                }}
                className="p-0.5 rounded hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] cursor-pointer flex-shrink-0"
              >
                <Check size={12} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-sm font-medium text-[var(--color-text)] truncate">{displayTitle}</span>
              <button
                onClick={startEditing}
                className="opacity-0 group-hover/chat:opacity-100 p-0.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-opacity cursor-pointer flex-shrink-0"
                title="Переименовать"
              >
                <Pencil size={10} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {formatRelativeDate(session.lastActiveAt)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(session);
              }}
              className="opacity-0 group-hover/chat:opacity-100 p-0.5 rounded hover:bg-[var(--color-danger)]/15 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all cursor-pointer"
              title="Удалить чат"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Bottom row: last message preview + message count */}
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[12px] text-[var(--color-text-muted)] truncate">
            {session.lastMessagePreview || 'Нет сообщений'}
          </span>
          {session.messageCount !== undefined && session.messageCount > 0 && (
            <span className="text-[10px] text-[var(--color-text-muted)]/60 flex items-center gap-0.5 flex-shrink-0 ml-auto">
              <MessageCircle size={9} />
              {session.messageCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatList({
  onOpenChat,
  onNewChat,
}: {
  onOpenChat: (avatar: string, chatFile: string) => void;
  onNewChat: () => void;
}) {
  const chatSessions = useAppStore((s) => s.chatSessions);
  const removeChatSession = useAppStore((s) => s.removeChatSession);
  const [search, setSearch] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatSessionMeta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteChat(deleteTarget.characterAvatar, deleteTarget.chatFile);
    } catch (err) {
      // 404 = file already gone on disk — still clean up the session
      if (!(err instanceof Error && err.message.includes('404'))) {
        console.error('Failed to delete chat:', err);
      }
    }
    removeChatSession(deleteTarget.characterAvatar, deleteTarget.chatFile);
    setDeleteTarget(null);
    setIsDeleting(false);
  };

  // Sync all chat sessions from backend in a single API call
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      setLoadingChats(true);
      try {
        const allChats = await api.getAllChats();
        if (cancelled) return;

        const { upsertChatSession, chatSessions: existing } = useAppStore.getState();
        for (const chat of allChats) {
          const already = existing.find(
            (s) => s.characterAvatar === chat.characterAvatar && s.chatFile === chat.chatFile,
          );
          let lastDate = chat.lastDate;
          if (!Number.isNaN(Number(lastDate))) {
            lastDate = new Date(Number(lastDate)).toISOString();
          }
          upsertChatSession({
            characterAvatar: chat.characterAvatar,
            characterName: chat.characterName,
            chatFile: chat.chatFile,
            createdAt: already?.createdAt ?? lastDate ?? new Date().toISOString(),
            lastActiveAt: lastDate ?? new Date().toISOString(),
            messageCount: chat.messageCount,
            lastMessagePreview: chat.lastMessage,
            title: already?.title,
          });
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingChats(false);
      }
    };
    sync();
    return () => {
      cancelled = true;
    };
  }, []);

  // Flat list sorted by last activity (most recent first), with search filter
  const sortedSessions = useMemo(() => {
    const sessions = [...chatSessions].sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
    );

    if (!search) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(
      (s) =>
        s.characterName.toLowerCase().includes(q) ||
        s.title?.toLowerCase().includes(q) ||
        s.lastMessagePreview?.toLowerCase().includes(q) ||
        s.chatFile.toLowerCase().includes(q),
    );
  }, [chatSessions, search]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Поиск чатов..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>
        <Button onClick={onNewChat}>
          <Plus size={15} />
          <span className="hidden sm:inline">Новый чат</span>
        </Button>
      </div>

      {/* Content */}
      {loadingChats ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Загрузка чатов...</span>
          </div>
        </div>
      ) : sortedSessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[var(--color-text-muted)]">
            <MessageCircle size={48} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm">{search ? 'Чаты не найдены' : 'Нет чатов. Начните новый!'}</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 overflow-y-auto pb-4">
          {sortedSessions.map((session) => (
            <ChatListItem
              key={`${session.characterAvatar}-${session.chatFile}`}
              session={session}
              onOpenChat={onOpenChat}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} onClose={() => !isDeleting && setDeleteTarget(null)} title="Удаление чата" size="sm">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-[var(--color-danger)]/15 flex-shrink-0">
              <AlertTriangle size={20} className="text-[var(--color-danger)]" />
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">
              Удалить чат <strong className="text-[var(--color-text)]">{deleteTarget?.title || 'Новый чат'}</strong> с
              персонажем <strong className="text-[var(--color-text)]">{deleteTarget?.characterName}</strong>? Это
              действие необратимо.
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Отмена
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Удалить
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Chat Settings Panel (right sidebar) ─────────────────────────────────────

function ChatSettingSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  modified,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  hint?: string;
  modified?: boolean;
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-center">
        <div className="relative flex items-center gap-1">
          <label
            className={clsx(
              'text-[10px] cursor-help',
              modified ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]',
            )}
            onMouseEnter={() => tooltip && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {label}
          </label>
          {showTooltip && tooltip && (
            <div className="absolute left-0 bottom-full mb-1 z-50 w-[min(13rem,calc(100vw-2rem))] px-2.5 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-lg text-[10px] leading-snug text-[var(--color-text-muted)] pointer-events-none">
              {tooltip}
            </div>
          )}
        </div>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-16 text-right bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-1 bg-[var(--color-surface-2)] rounded-full appearance-none cursor-pointer accent-[var(--color-primary)]"
      />
      {hint && <span className="text-[9px] text-[var(--color-text-muted)] opacity-50">{hint}</span>}
    </div>
  );
}

function ContextTrimToggle({
  value,
  onChange,
  modified,
}: {
  value: ContextTrimStrategy;
  onChange: (v: ContextTrimStrategy) => void;
  modified?: boolean;
}) {
  const options: { key: ContextTrimStrategy; label: string }[] = [
    { key: 'trim_start', label: 'Начало' },
    { key: 'trim_middle', label: 'Середина' },
  ];
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center gap-1">
        <label
          className={clsx(
            'text-[10px] cursor-help',
            modified ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]',
          )}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          Обрезка контекста
        </label>
        {showTooltip && (
          <div className="absolute left-0 bottom-full mb-1 z-50 w-[min(13rem,calc(100vw-2rem))] px-2.5 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-lg text-[10px] leading-snug text-[var(--color-text-muted)] pointer-events-none">
            Что удалять при заполнении контекста. «Начало» — самые старые сообщения удаляются первыми. «Середина» —
            сохраняет начало чата (завязка, приветствие) и последние сообщения, удаляя середину.
          </div>
        )}
      </div>
      <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={clsx(
              'flex-1 px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer',
              value === opt.key
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModelSettingsSection() {
  const { llmServerConfig, setLlmServerConfig, backendMode, connection } = useAppStore();
  const [localContextSize, setLocalContextSize] = useState(llmServerConfig.contextSize);
  const [restarting, setRestarting] = useState(false);

  // Sync local state when store changes externally
  useEffect(() => {
    setLocalContextSize(llmServerConfig.contextSize);
  }, [llmServerConfig.contextSize]);

  const hasChanged = localContextSize !== llmServerConfig.contextSize;
  const isBuiltinRunning = backendMode === 'builtin' && connection.connected;

  const handleApply = async () => {
    if (!hasChanged) return;

    if (isBuiltinRunning) {
      // Restart server with new context size
      setRestarting(true);
      try {
        // Get current model path from server status
        const status = await api.getLlmServerStatus();
        const modelPath = status.modelPath;

        if (!modelPath) {
          // No model path — just update config
          setLlmServerConfig({ contextSize: localContextSize });
          setRestarting(false);
          return;
        }

        // Update config
        setLlmServerConfig({ contextSize: localContextSize });

        // Stop server
        await api.stopLlmServer();

        // Poll until idle
        let attempts = 0;
        while (attempts < 60) {
          await new Promise((r) => setTimeout(r, 500));
          const s = await api.getLlmServerStatus();
          if (s.status === 'idle' || s.status === 'error') break;
          attempts++;
        }

        // Restart with new config
        const cfg = useAppStore.getState().llmServerConfig;
        await api.startLlmServer({
          modelPath,
          port: cfg.port,
          gpuLayers: cfg.gpuLayers,
          contextSize: cfg.contextSize,
          flashAttention: cfg.flashAttention,
          threads: cfg.threads,
        });
      } catch (err) {
        console.error('[ModelSettings] restart failed:', err);
      } finally {
        setRestarting(false);
      }
    } else {
      // External mode or server not running — just update config
      setLlmServerConfig({ contextSize: localContextSize });
    }
  };

  return (
    <div className="flex flex-col gap-2.5 border-t border-[var(--color-border)] pt-3">
      <div className="flex items-center gap-1.5">
        <Cpu size={10} className="text-[var(--color-primary)]" />
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          Настройки модели
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-[var(--color-text-muted)]">Context Size</label>
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
            {localContextSize.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min={2048}
          max={131072}
          step={1024}
          value={localContextSize}
          onChange={(e) => setLocalContextSize(Number(e.target.value))}
          className="w-full accent-[var(--color-primary)]"
          disabled={restarting}
        />
        <div className="flex items-center justify-between text-[9px] text-[var(--color-text-muted)] opacity-50">
          <span>2K</span>
          <span>128K</span>
        </div>
      </div>

      {hasChanged && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleApply}
            disabled={restarting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {restarting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Перезапуск сервера...
              </>
            ) : (
              <>
                <Check size={12} />
                Применить{isBuiltinRunning ? ' (перезапуск)' : ''}
              </>
            )}
          </button>
          <button
            onClick={() => setLocalContextSize(llmServerConfig.contextSize)}
            disabled={restarting}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="Сбросить"
          >
            <Reset size={14} />
          </button>
        </div>
      )}

      {!hasChanged && isBuiltinRunning && (
        <div className="text-[9px] text-[var(--color-text-muted)] opacity-50">
          Изменение контекста перезапустит сервер
        </div>
      )}
    </div>
  );
}

/** Compute the "core" system prompt (no World Info, no language enforcement).
 *  Used by both buildChatData and the SystemPromptSection preview. */
function computeBaseSystemPrompt(
  character: Character,
  sessionOverrides?: Partial<Character>,
  activeScenario?: Scenario | null,
): string {
  const { userPersona, userName, systemPromptTemplate, responseLanguage } = useAppStore.getState();
  const ch = sessionOverrides ? { ...character, ...sessionOverrides } : character;

  let text: string;
  if (ch.system_prompt) {
    text = ch.system_prompt.replace(/\{\{char\}\}/g, ch.name).replace(/\{\{user\}\}/g, userName || 'User');
  } else {
    // Use language-appropriate default if the template hasn't been customized
    const template = DEFAULT_PROMPTS.includes(systemPromptTemplate)
      ? getDefaultSystemPrompt(responseLanguage)
      : systemPromptTemplate;
    text = template
      .replace(/\{\{char\}\}/g, ch.name)
      .replace(/\{\{user\}\}/g, userName || 'User')
      .replace(/\{\{description\}\}/g, ch.description || '')
      .replace(/\{\{personality\}\}/g, ch.personality || '')
      .replace(/\{\{scenario\}\}/g, activeScenario?.content || '')
      .replace(/\{\{userPersona\}\}/g, userPersona || '');

    text = text.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName: string, content: string) => {
      const vars: Record<string, string | undefined> = {
        personality: ch.personality,
        scenario: activeScenario?.content,
        userPersona,
      };
      return vars[varName] ? content : '';
    });
  }
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function ScenarioDisplay({ session }: { session: ChatSessionMeta | null }) {
  const activeScenarioName = session?.activeScenarioName;
  if (!activeScenarioName) return null;

  return (
    <div className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-3">
      <div className="flex items-center gap-1.5">
        <FileText size={10} className="text-[var(--color-primary)]" />
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Сценарий</span>
      </div>
      <div className="text-xs text-[var(--color-text)]">{activeScenarioName}</div>
      <div className="text-[9px] text-[var(--color-text-muted)] opacity-60">Выбирается при создании чата</div>
    </div>
  );
}

function SystemPromptSection({
  session,
  character,
  activeScenario,
  onSettingsChanged,
}: {
  session: ChatSessionMeta | null;
  character: Character | null;
  activeScenario: Scenario | null;
  onSettingsChanged?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const upsertChatSession = useAppStore((s) => s.upsertChatSession);

  const autoPrompt = useMemo(() => {
    if (!character) return '';
    return computeBaseSystemPrompt(character, session?.characterOverrides, activeScenario);
  }, [character, session?.characterOverrides, activeScenario]);

  const hasOverride = !!session?.customSystemPrompt;
  const displayText = hasOverride ? session!.customSystemPrompt! : autoPrompt;

  const [editText, setEditText] = useState(displayText);

  useEffect(() => {
    setEditText(displayText);
  }, [displayText]);

  const isDirty = editText !== displayText;

  const handleSave = () => {
    if (!session) return;
    upsertChatSession({ ...session, customSystemPrompt: editText });
    onSettingsChanged?.();
  };

  const handleReset = () => {
    if (!session) return;
    upsertChatSession({ ...session, customSystemPrompt: null });
    setEditText(autoPrompt);
    onSettingsChanged?.();
  };

  if (!character) return null;

  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-3">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 cursor-pointer group">
        <ChevronRight
          size={12}
          className={clsx('text-[var(--color-primary)] transition-transform duration-200', expanded && 'rotate-90')}
        />
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide group-hover:text-[var(--color-text)] transition-colors">
          Системный промпт
        </span>
        {hasOverride && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
            Custom
          </span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 mt-1">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={12}
            className="w-full text-[11px] leading-relaxed bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2.5 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors resize-y font-mono"
          />
          <div className="text-[9px] text-[var(--color-text-muted)] opacity-60">
            World Info и язык добавляются автоматически
          </div>
          <div className="flex items-center gap-1.5">
            {isDirty && (
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 transition-colors cursor-pointer"
              >
                <Check size={10} />
                Сохранить
              </button>
            )}
            {hasOverride && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-[var(--color-surface-2)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15 transition-colors cursor-pointer"
              >
                <Reset size={10} />
                Сбросить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatSettingsPanel({
  session,
  chatFile,
  character,
  activeScenario,
  onClose,
  onSettingsChanged,
}: {
  session: ChatSessionMeta | null;
  chatFile: string | null;
  character: Character | null;
  activeScenario: Scenario | null;
  onClose: () => void;
  onSettingsChanged?: () => void;
}) {
  const upsertChatSession = useAppStore((s) => s.upsertChatSession);
  const state = useAppStore.getState();

  // Base preset (model or global) and effective settings (base + chat overrides)
  const basePreset = getBasePreset(state);
  const effective = getEffectiveSamplerSettings(state, chatFile ?? undefined);

  const customOverrides = session?.customSamplerSettings ?? {};
  const hasOverrides = Object.keys(customOverrides).length > 0;

  const updateSession = (patch: Partial<ChatSessionMeta>) => {
    if (!session) return;
    upsertChatSession({ ...session, ...patch });
    // Persist to chat file
    onSettingsChanged?.();
  };

  const handleOverride = (key: keyof SamplerSettings, value: SamplerSettings[keyof SamplerSettings]) => {
    updateSession({ customSamplerSettings: { ...customOverrides, [key]: value } });
  };

  const handleResetOverrides = () => {
    updateSession({ customSamplerSettings: {} });
  };

  return (
    <div className="w-full sm:w-72 fixed inset-0 sm:relative sm:inset-auto z-30 sm:z-auto flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1.5">
          <Sliders size={13} className="text-[var(--color-primary)]" />
          <span className="text-xs font-semibold text-[var(--color-text)]">Настройки чата</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-3">
        {/* Active preset info + Custom badge + Reset */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Пресет
              </label>
              <span
                className={clsx(
                  'text-xs font-medium',
                  hasOverrides ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]',
                )}
              >
                {hasOverrides ? 'Custom' : basePreset.name}
              </span>
            </div>
            {hasOverrides && (
              <span className="text-[9px] text-[var(--color-text-muted)] opacity-60">({basePreset.name})</span>
            )}
          </div>
          {hasOverrides && (
            <button
              onClick={handleResetOverrides}
              className="text-[10px] px-2 py-1 rounded-md bg-[var(--color-surface-2)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15 cursor-pointer flex items-center gap-1 transition-colors"
            >
              <Reset size={10} />
              Сбросить
            </button>
          )}
        </div>

        {/* Per-chat overrides */}
        <div className="flex flex-col gap-1.5">
          {!hasOverrides && (
            <div className="text-[9px] text-[var(--color-text-muted)] opacity-60 mb-1">
              Измените значение, чтобы создать переопределение для этого чата
            </div>
          )}

          <div className="flex flex-col gap-3">
            <ChatSettingSlider
              label="Temperature"
              tooltip="Креативность ответов. Низкие значения (0.1–0.5) — предсказуемый текст, высокие (0.8–1.5) — разнообразный и неожиданный. Слишком высокие значения могут давать бессвязный текст."
              value={customOverrides.temperature ?? effective.temperature}
              onChange={(v) => handleOverride('temperature', v)}
              modified={'temperature' in customOverrides}
              min={0.1}
              max={2.0}
              step={0.05}
            />
            <ChatSettingSlider
              label="Min P"
              tooltip="Отсекает токены, вероятность которых ниже заданной доли от самого вероятного. Например, 0.05 = убрать всё, что менее 5% от лучшего варианта. Хорошо убирает мусор, сохраняя разнообразие."
              value={customOverrides.min_p ?? effective.min_p}
              onChange={(v) => handleOverride('min_p', v)}
              modified={'min_p' in customOverrides}
              min={0}
              max={0.5}
              step={0.01}
            />
            <ChatSettingSlider
              label="Top P"
              tooltip="Nucleus sampling — выбирает из наименьшего набора токенов, чья суммарная вероятность ≥ значения. 1.0 = все токены, 0.9 = верхние 90% вероятности. Чем ниже, тем консервативнее."
              value={customOverrides.top_p ?? effective.top_p}
              onChange={(v) => handleOverride('top_p', v)}
              modified={'top_p' in customOverrides}
              min={0}
              max={1}
              step={0.05}
            />
            <ChatSettingSlider
              label="Top K"
              tooltip="Ограничивает выбор только K самыми вероятными токенами. 0 = без ограничения, 40 = только топ-40 вариантов. Грубый фильтр, лучше использовать Min P."
              value={customOverrides.top_k ?? effective.top_k}
              onChange={(v) => handleOverride('top_k', v)}
              modified={'top_k' in customOverrides}
              min={0}
              max={200}
              step={1}
            />
            <ChatSettingSlider
              label="Rep. Penalty"
              tooltip="Штраф за повторение токенов. 1.0 = выключено, 1.05–1.10 = мягкий штраф, >1.15 = агрессивный (может ломать текст). Помогает избежать зацикливания на одних и тех же фразах."
              value={customOverrides.rep_pen ?? effective.rep_pen}
              onChange={(v) => handleOverride('rep_pen', v)}
              modified={'rep_pen' in customOverrides}
              min={1}
              max={1.5}
              step={0.01}
            />
            <ChatSettingSlider
              label="Rep. Pen. Range"
              tooltip="Сколько последних токенов учитывать для штрафа за повторение. 0 = отключено, 2048 = последние ~2048 токенов (включая предыдущие сообщения в контексте)."
              value={customOverrides.rep_pen_range ?? effective.rep_pen_range}
              onChange={(v) => handleOverride('rep_pen_range', v)}
              modified={'rep_pen_range' in customOverrides}
              min={0}
              max={8192}
              step={128}
            />
            <ChatSettingSlider
              label="Presence Penalty"
              tooltip="Штраф за присутствие токена в предыдущем тексте. В отличие от Rep. Penalty, штрафует одинаково вне зависимости от количества повторений. 0 = выключено."
              value={customOverrides.presence_penalty ?? effective.presence_penalty}
              onChange={(v) => handleOverride('presence_penalty', v)}
              modified={'presence_penalty' in customOverrides}
              min={0}
              max={2}
              step={0.05}
            />
            <ChatSettingSlider
              label="Max Tokens"
              tooltip="Максимальная длина ответа модели в токенах. 1 токен ≈ 3–4 символа. 256 = короткий ответ, 512–1024 = развёрнутый. Для моделей с thinking (Qwen3) рекомендуется 4096–32768, т.к. размышления тоже расходуют токены."
              value={customOverrides.max_length ?? effective.max_length}
              onChange={(v) => handleOverride('max_length', v)}
              modified={'max_length' in customOverrides}
              min={64}
              max={32768}
              step={64}
            />
            {/* Context trim strategy */}
            <ContextTrimToggle
              value={customOverrides.context_trim_strategy ?? effective.context_trim_strategy}
              onChange={(v) => handleOverride('context_trim_strategy', v)}
              modified={'context_trim_strategy' in customOverrides}
            />
          </div>
        </div>

        {/* ── Model settings (context size) ── */}
        <ModelSettingsSection />

        {/* ── Scenario (read-only display) ── */}
        <ScenarioDisplay session={session} />

        {/* ── System prompt preview/editor ── */}
        <SystemPromptSection
          session={session}
          character={character}
          activeScenario={activeScenario}
          onSettingsChanged={onSettingsChanged}
        />
      </div>
    </div>
  );
}

// ── Active Chat View ────────────────────────────────────────────────────────

export function ActiveChatView() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { upsertChatSession, connection, chatSessions, streamingEnabled, sidebarCollapsed, toggleSidebar } =
    useAppStore();

  // Look up the session by chatId (which is the chatFile / timestamp)
  const session = chatSessions.find((s) => s.chatFile === chatId);
  const characterAvatar = session?.characterAvatar ?? null;
  const chatFile = chatId ?? null;
  const activeChat = characterAvatar && chatFile ? { characterAvatar, chatFile } : null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [lastPromptLength, setLastPromptLength] = useState(0);
  const [error, setError] = useState('');
  const [character, setCharacter] = useState<Character | null>(null);
  const [lorebook, setLorebook] = useState<WorldInfo | null>(null);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chatHeaderRef = useRef<Record<string, unknown> | null>(null);
  const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullPromptLengthRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastAbortTime = useRef<number>(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScroll = useRef(true);

  // Load character and chat data (use primitive deps to avoid infinite loop)
  useEffect(() => {
    if (!characterAvatar || !chatFile) return;
    loadChat();
  }, [characterAvatar, chatFile, loadChat]);

  // Load active scenario when session changes
  const activeScenarioName = session?.activeScenarioName;
  useEffect(() => {
    if (!activeScenarioName) {
      setActiveScenario(null);
      return;
    }
    api
      .getScenario(activeScenarioName)
      .then(setActiveScenario)
      .catch(() => setActiveScenario(null));
  }, [activeScenarioName]);

  // Smart auto-scroll
  useEffect(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  useEffect(() => {
    if (!isGenerating) {
      inputRef.current?.focus();
    }
  }, [isGenerating]);

  const loadChat = async () => {
    if (!activeChat) return;
    const { removeChatSession } = useAppStore.getState();
    const isEmptyChar = activeChat.characterAvatar === '_no_character_';
    try {
      let char: Character | null = null;
      if (isEmptyChar) {
        // No-character chat — use a minimal stub
        char = { name: '', description: '', personality: '', mes_example: '', tags: [] };
      } else {
        char = await api.getCharacterByAvatar(activeChat.characterAvatar);
        if (!char) {
          // Character no longer exists — remove stale session and go back
          removeChatSession(activeChat.characterAvatar, activeChat.chatFile);
          navigate('/chat', { replace: true });
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
      const model = connection.connected ? connection.model : undefined;
      upsertChatSession({
        characterAvatar: activeChat.characterAvatar,
        characterName: char.name,
        chatFile: activeChat.chatFile,
        model,
        createdAt:
          useAppStore.getState().getChatSession(activeChat.characterAvatar, activeChat.chatFile)?.createdAt ??
          new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      });

      const chatData = await api.getChatMessages(activeChat.characterAvatar, activeChat.chatFile);
      const allLines = chatData as unknown as Array<Record<string, unknown>>;
      const header = allLines.find((m) => 'chat_metadata' in m);
      if (header) chatHeaderRef.current = header;
      const msgs = allLines
        .filter((m) => !('chat_metadata' in m) && m.mes !== undefined)
        .map((m) => m as unknown as ChatMessage);
      setMessages(msgs);
      shouldAutoScroll.current = true;

      // Restore per-chat sampler overrides from chat file metadata
      const chatMeta = (header?.chat_metadata ?? {}) as Record<string, unknown>;
      const savedOverrides = chatMeta.customSamplerSettings as Partial<SamplerSettings> | undefined;
      const savedSystemPrompt = chatMeta.customSystemPrompt as string | undefined;

      // Update session with message count/preview + overrides from file
      const existingSession = useAppStore.getState().getChatSession(activeChat.characterAvatar, activeChat.chatFile);
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        upsertChatSession({
          characterAvatar: activeChat.characterAvatar,
          characterName: char?.name ?? '',
          chatFile: activeChat.chatFile,
          createdAt: existingSession?.createdAt ?? new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          messageCount: msgs.length,
          lastMessagePreview: lastMsg.mes.slice(0, 120),
          title: existingSession?.title, // preserve title
          customSamplerSettings: savedOverrides, // restore from chat file
          customSystemPrompt: savedSystemPrompt, // restore system prompt override
        });

        // Generate title for existing chats that don't have one yet
        if (!existingSession?.title && msgs.some((m) => !m.is_user && !m.is_system) && char) {
          api
            .generateChatTitle(
              msgs
                .filter((m) => !m.is_system)
                .map((m) => ({ name: m.name, mes: m.is_user ? m.mes : stripThinkBlocks(m.mes) })),
              char.name,
            )
            .then((title) => {
              if (title) {
                const current = useAppStore.getState().getChatSession(activeChat.characterAvatar, activeChat.chatFile);
                if (current && !current.title) {
                  useAppStore.getState().upsertChatSession({ ...current, title });
                }
              }
            })
            .catch(() => {
              /* ignore */
            });
        }
      } else if (existingSession) {
        // Chat file is empty/missing — sync session metadata
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
  };

  /** Build structured messages array for OpenAI-compatible chat completions API
   *  and also a raw ChatML prompt (used as fallback / context indicator). */
  const buildChatData = useCallback(
    (msgs: ChatMessage[]): { prompt: string; messages: Array<{ role: string; content: string }> } => {
      if (!character) return { prompt: '', messages: [] };
      const { responseLanguage, thinkingEnabled, getChatSession } = useAppStore.getState();

      // Merge per-chat character overrides on top of the card data
      const sessionOverrides = chatFile
        ? getChatSession(character.avatar ?? '', chatFile)?.characterOverrides
        : undefined;
      const ch = sessionOverrides ? { ...character, ...sessionOverrides } : character;

      // Check for per-chat system prompt override
      const sessionMeta = chatFile ? getChatSession(character.avatar ?? '', chatFile) : undefined;
      let systemText: string;
      if (sessionMeta?.customSystemPrompt) {
        systemText = sessionMeta.customSystemPrompt;
      } else {
        systemText = computeBaseSystemPrompt(character, sessionOverrides, activeScenario);
      }

      // Append language enforcement to system prompt (must be in first system message
      // because Qwen3.5 and similar templates require system messages at the beginning)
      if (responseLanguage === 'ru') {
        systemText += '\n\n[Пиши только на русском языке. Не переключайся на английский.]';
      } else if (responseLanguage === 'en') {
        systemText += '\n\n[Write only in English. Do not switch to other languages.]';
      }

      // Merge world info into system text (strict templates like Qwen3.5
      // only allow a single system message at the very beginning)
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

      // ── Build structured messages array ──────────────────────────────
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

      // ── Context window management ──────────────────────────────────
      const samplers = getEffectiveSamplerSettings(useAppStore.getState(), chatFile ?? undefined);
      const contextSize = useAppStore.getState().llmServerConfig.contextSize;
      // Reserve at least 25% of context for the prompt even if max_length is very large
      // (e.g. thinking models with max_length == contextSize)
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
      const estimateTokens = (text: string) => Math.round(text.length / 3.5);
      const includedEntries: Array<{ role: string; content: string }> = [];

      if (samplers.context_trim_strategy === 'trim_middle') {
        // Keep first messages (up to 25% of budget) + last messages (remaining budget)
        const headBudget = Math.floor(tokenBudget * 0.25);
        let headTokens = 0;
        let headEnd = 0;
        for (let i = 0; i < chatEntries.length; i++) {
          const t = estimateTokens(chatEntries[i].content);
          if (headTokens + t > headBudget) break;
          headTokens += t;
          headEnd = i + 1;
        }
        // Fill from the end with remaining budget
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
        // trim_start: walk backwards, drop oldest messages first
        let remaining = tokenBudget;
        for (let i = chatEntries.length - 1; i >= 0; i--) {
          const entryTokens = estimateTokens(chatEntries[i].content);
          if (remaining - entryTokens < 0) break;
          includedEntries.unshift(chatEntries[i]);
          remaining -= entryTokens;
        }
      }

      chatMessages.push(...includedEntries);

      // ── Build raw ChatML prompt (for fallback / context indicator) ──
      let prompt = '';
      for (const m of chatMessages) {
        prompt += `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`;
      }
      prompt += '<|im_start|>assistant\n';

      // Non-thinking mode: prefill empty think block in raw prompt
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

  // Estimate prompt length for context indicator (use full untruncated length)
  useEffect(() => {
    if (!character || messages.length === 0) {
      setLastPromptLength(0);
      return;
    }
    buildChatData(messages); // triggers fullPromptLengthRef update
    setLastPromptLength(fullPromptLengthRef.current);
  }, [messages, character, buildChatData]);

  const buildChatForSave = (msgs: ChatMessage[]) => {
    const header = chatHeaderRef.current ?? { chat_metadata: {}, user_name: '', character_name: character?.name ?? '' };
    // Persist per-chat sampler overrides inside the chat file
    const session = activeChat
      ? useAppStore.getState().getChatSession(activeChat.characterAvatar, activeChat.chatFile)
      : null;
    const metadata = (header.chat_metadata ?? {}) as Record<string, unknown>;
    if (session?.customSamplerSettings && Object.keys(session.customSamplerSettings).length > 0) {
      metadata.customSamplerSettings = session.customSamplerSettings;
    } else {
      delete metadata.customSamplerSettings;
    }
    if (session?.customSystemPrompt) {
      metadata.customSystemPrompt = session.customSystemPrompt;
    } else {
      delete metadata.customSystemPrompt;
    }
    const updatedHeader = { ...header, chat_metadata: metadata };
    chatHeaderRef.current = updatedHeader;
    return [updatedHeader, ...msgs] as unknown as Record<string, unknown>[];
  };

  const updateSessionMeta = (msgs: ChatMessage[]) => {
    if (!activeChat || !character) return;
    const lastMsg = msgs[msgs.length - 1];
    const existing = useAppStore.getState().getChatSession(activeChat.characterAvatar, activeChat.chatFile);
    upsertChatSession({
      characterAvatar: activeChat.characterAvatar,
      characterName: character.name,
      chatFile: activeChat.chatFile,
      model: connection.connected ? connection.model : undefined,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      messageCount: msgs.length,
      lastMessagePreview: lastMsg?.mes.slice(0, 120),
      title: existing?.title, // preserve existing title
    });
  };

  /** Fire-and-forget: generate a chat title after first assistant reply */
  const maybeGenerateTitle = (msgs: ChatMessage[]) => {
    if (!activeChat || !character) return;
    const session = useAppStore.getState().getChatSession(activeChat.characterAvatar, activeChat.chatFile);
    // Only generate if no title yet and we have at least one assistant message
    if (session?.title) return;
    const hasAssistantMsg = msgs.some((m) => !m.is_user && !m.is_system);
    if (!hasAssistantMsg) return;

    // Fire and forget — don't await
    api
      .generateChatTitle(
        msgs
          .filter((m) => !m.is_system)
          .map((m) => ({ name: m.name, mes: m.is_user ? m.mes : stripThinkBlocks(m.mes) })),
        character.name,
      )
      .then((title) => {
        if (title) {
          const current = useAppStore.getState().getChatSession(activeChat.characterAvatar, activeChat.chatFile);
          if (current && !current.title) {
            useAppStore.getState().upsertChatSession({ ...current, title });
          }
        }
      })
      .catch(() => {
        // silently ignore title generation errors
      });
  };

  /** Wait if a generation was recently aborted so KoboldCpp can finish cleanup */
  const waitAfterAbort = async () => {
    const elapsed = Date.now() - lastAbortTime.current;
    if (elapsed < 1000) {
      await new Promise((r) => setTimeout(r, 1000 - elapsed));
    }
  };

  /**
   * Core generation logic shared by handleSend, handleGenerate, and handleRegenerate.
   * Takes the messages to use as context, generates an assistant reply, saves, and updates state.
   */
  const runGeneration = async (
    msgsForGeneration: ChatMessage[],
    opts?: { generateTitle?: boolean; preSave?: boolean },
  ) => {
    await waitAfterAbort();

    if (opts?.preSave) {
      await api.saveChat(activeChat!.characterAvatar, activeChat!.chatFile, buildChatForSave(msgsForGeneration));
    }

    const { messages: chatCompletionMessages } = buildChatData(msgsForGeneration);
    const { thinkingEnabled, backendMode, llmServerConfig } = useAppStore.getState();
    const settings = await api.getSettings();
    const textGen = settings?.textgenerationwebui as Record<string, unknown> | undefined;
    const urls = textGen?.server_urls as Record<string, string> | undefined;
    const rawUrl = urls?.koboldcpp ?? 'http://127.0.0.1:5001';
    const apiServer = backendMode === 'builtin' ? rawUrl : rawUrl.endsWith('/api') ? rawUrl : `${rawUrl}/api`;

    abortRef.current = new AbortController();
    const samplers = getEffectiveSamplerSettings(useAppStore.getState(), chatFile ?? undefined);

    const generatedText = await api.generateTextStream(
      {
        api_server: apiServer,
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
      name: character!.name,
      is_user: false,
      mes: stripThinkBlocks(generatedText),
      send_date: new Date().toISOString(),
      extra: {},
    };

    const finalMessages = [...msgsForGeneration, assistantMessage];
    setMessages(finalMessages);
    setError('');

    try {
      await api.saveChat(activeChat!.characterAvatar, activeChat!.chatFile, buildChatForSave(finalMessages));
      updateSessionMeta(finalMessages);
      if (opts?.generateTitle) maybeGenerateTitle(finalMessages);
    } catch (saveErr) {
      console.error('Failed to save chat:', saveErr);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeChat || !character || isGenerating || !connection.connected) return;
    setError('');
    shouldAutoScroll.current = true;

    const userMessage: ChatMessage = {
      name: useAppStore.getState().userName || 'User',
      is_user: true,
      mes: input.trim(),
      send_date: new Date().toISOString(),
      extra: {},
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsGenerating(true);
    setStreamText('');

    if (inputRef.current) inputRef.current.style.height = 'auto';

    try {
      await runGeneration(updatedMessages, { preSave: true, generateTitle: true });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error(err);
        setError('Произошла ошибка. Попробуйте ещё раз.');
      }
    } finally {
      setIsGenerating(false);
      setStreamText('');
      abortRef.current = null;
    }
  };

  /** Generate an assistant response without sending a user message */
  const handleGenerate = async () => {
    if (messages.length === 0 || isGenerating || !activeChat || !character || !connection.connected) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && !lastMsg.is_user && !lastMsg.is_system) return;

    setError('');
    shouldAutoScroll.current = true;
    setIsGenerating(true);
    setStreamText('');

    try {
      await runGeneration(messages, { generateTitle: true });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error(err);
        setError('Произошла ошибка. Попробуйте ещё раз.');
      }
    } finally {
      setIsGenerating(false);
      setStreamText('');
      abortRef.current = null;
    }
  };

  const handleRegenerate = async () => {
    if (messages.length === 0 || isGenerating || !activeChat || !character || !connection.connected) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.is_user) return;

    const withoutLast = messages.slice(0, -1);
    setMessages(withoutLast);
    setError('');
    shouldAutoScroll.current = true;
    setIsGenerating(true);
    setStreamText('');

    try {
      await runGeneration(withoutLast, { preSave: true });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error(err);
        setError('Произошла ошибка. Попробуйте ещё раз.');
      }
    } finally {
      setIsGenerating(false);
      setStreamText('');
      abortRef.current = null;
    }
  };

  const handleStop = async () => {
    lastAbortTime.current = Date.now();
    // 1. Tell backend to abort KoboldCpp (backend remembers the server URL)
    try {
      await api.abortGeneration();
    } catch {
      // ignore — best effort
    }
    // 2. Abort the client-side fetch (cleans up SSE reader)
    abortRef.current?.abort();
  };

  const handleEditMessage = async (index: number, newText: string) => {
    if (!newText || index < 0 || index >= messages.length || isGenerating) return;
    const updated = [...messages];
    updated[index] = { ...updated[index], mes: newText };
    setMessages(updated);
    if (activeChat) {
      await api.saveChat(activeChat.characterAvatar, activeChat.chatFile, buildChatForSave(updated));
      updateSessionMeta(updated);
    }
  };

  const handleDeleteMessage = async (index: number) => {
    if (index < 0 || index >= messages.length || isGenerating) return;
    const updated = messages.filter((_, i) => i !== index);
    setMessages(updated);
    if (activeChat) {
      await api.saveChat(activeChat.characterAvatar, activeChat.chatFile, buildChatForSave(updated));
      updateSessionMeta(updated);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Ctrl+R hotkey for generate / regenerate
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        if (isGenerating || messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.is_user) {
          handleGenerate();
        } else if (lastMsg && !lastMsg.is_user && !lastMsg.is_system) {
          handleRegenerate();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [messages, isGenerating, handleGenerate, handleRegenerate]);

  const handleBack = () => {
    navigate('/chat');
  };

  // Redirect to chat list if session not found
  useEffect(() => {
    if (chatId && !activeChat) {
      navigate('/chat', { replace: true });
    }
  }, [chatId, activeChat, navigate]);

  if (!activeChat) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-x-hidden">
      {/* Chat header — sticky so it stays visible when scrolling on mobile */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0 sticky top-0 z-10">
        {/* Mobile sidebar toggle */}
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer md:hidden"
          >
            <Menu size={16} />
          </button>
        )}
        <button
          onClick={handleBack}
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
        <div className="flex items-center gap-1">
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
                        dangerouslySetInnerHTML={{ __html: formatMessageContent(streamText, true) }}
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
            chatFile={chatFile}
            character={character}
            activeScenario={activeScenario}
            onClose={() => setSettingsOpen(false)}
            onSettingsChanged={() => {
              // Debounce save to avoid excessive writes while sliding
              if (settingsSaveTimerRef.current) clearTimeout(settingsSaveTimerRef.current);
              settingsSaveTimerRef.current = setTimeout(() => {
                if (activeChat) {
                  api
                    .saveChat(activeChat.characterAvatar, activeChat.chatFile, buildChatForSave(messages))
                    .catch((err) => console.warn('Failed to save chat settings:', err));
                }
              }, 500);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Main Chat Page (combines list + active chat) ────────────────────────────

export function ChatPage() {
  const navigate = useNavigate();

  const handleOpenChat = (_avatar: string, chatFile: string) => {
    navigate(`/chat/${encodeURIComponent(chatFile)}`);
  };

  const handleNewChat = () => {
    navigate('/characters');
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5">
      <ChatList onOpenChat={handleOpenChat} onNewChat={handleNewChat} />
    </div>
  );
}
