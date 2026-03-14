import { clsx } from 'clsx';
import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTime, wordCount } from '@/lib/dateFormatting';
import { formatMarkdown, formatMessageContent } from '@/lib/messageFormatting';
import type { ChatMessage } from '@/types';
import { MessageEditForm } from './MessageEditForm';

interface MessageBubbleProps {
  message: ChatMessage;
  characterAvatar?: string;
  isLast: boolean;
  onEdit: (newText: string) => void;
  onDelete: () => void;
  onRegenerate?: () => void;
  isGenerating: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  characterAvatar,
  isLast,
  onEdit,
  onDelete,
  onRegenerate,
  isGenerating,
}: MessageBubbleProps) {
  const { t } = useTranslation();
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

  // Auto-resize on text change
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
              <MessageEditForm
                editText={editText}
                editRef={editRef}
                isUser={isUser}
                onChange={handleEditChange}
                onKeyDown={handleEditKeyDown}
                onSave={saveEdit}
                onCancel={cancelEditing}
              />
            ) : (
              <div
                className="whitespace-pre-wrap break-words overflow-hidden [overflow-wrap:anywhere] [&_em]:italic [&_strong]:font-bold"
                dangerouslySetInnerHTML={{ __html: formattedHtml }}
              />
            )}
          </div>
        </div>
        {!isEditing && (
          <div className={clsx('flex items-center px-1', isUser ? 'gap-2' : 'ml-10 sm:ml-12 justify-between')}>
            {time && (
              <span className="text-[10px] text-[var(--color-text-muted)]/50 flex-shrink-0">
                {time}
                {!isUser && words > 0 && ` · ${words} ${t('chat.wordsShort')}`}
              </span>
            )}
            {!isGenerating && (
              <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5">
                {isAssistant && isLast && onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="p-0.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer transition-colors"
                    title={t('chat.regenerateTooltip')}
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
                <button
                  onClick={startEditing}
                  className="p-0.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer transition-colors"
                  title={t('chat.editTooltip')}
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={onDelete}
                  className="p-0.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] cursor-pointer transition-colors"
                  title={t('chat.deleteTooltip')}
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
