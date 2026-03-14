import { Check, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatRelativeDate } from '@/lib/dateFormatting';
import { hideOnImageError } from '@/lib/imageUtils';
import { useAppStore } from '@/stores';
import type { ChatSessionMeta } from '@/types';

interface TitleEditProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  onSaveMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

function TitleEdit({
  inputRef,
  value,
  placeholder,
  onChange,
  onKeyDown,
  onBlur,
  onSaveMouseDown,
  onClick,
}: TitleEditProps): JSX.Element {
  return (
    <div className="flex items-center gap-1 flex-1 min-w-0" onClick={onClick}>
      <input
        ref={inputRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-primary)] rounded px-1.5 py-0.5 text-sm text-[var(--color-text)] outline-none min-w-0"
      />
      <button
        onMouseDown={onSaveMouseDown}
        className="p-0.5 rounded hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] cursor-pointer flex-shrink-0"
      >
        <Check size={12} />
      </button>
    </div>
  );
}

interface TitleDisplayProps {
  title: string;
  renameTooltip: string;
  onStartEditing: (e: React.MouseEvent) => void;
}

function TitleDisplay({ title, renameTooltip, onStartEditing }: TitleDisplayProps): JSX.Element {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-sm font-medium text-[var(--color-text)] truncate">{title}</span>
      <button
        onClick={onStartEditing}
        className="opacity-0 group-hover/chat:opacity-100 p-0.5 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-opacity cursor-pointer flex-shrink-0"
        title={renameTooltip}
      >
        <Pencil size={10} />
      </button>
    </div>
  );
}

interface ChatListItemProps {
  session: ChatSessionMeta;
  onOpenChat: (avatar: string, chatFile: string) => void;
  onDelete: (session: ChatSessionMeta) => void;
}

export const ChatListItem = memo(function ChatListItem({ session, onOpenChat, onDelete }: ChatListItemProps) {
  const { t } = useTranslation();
  const upsertChatSession = useAppStore((s) => s.upsertChatSession);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditValue(session.title || '');
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [session.title],
  );

  const saveTitle = useCallback(() => {
    const trimmed = editValue.trim();
    upsertChatSession({ ...session, title: trimmed || undefined });
    setEditing(false);
  }, [editValue, session, upsertChatSession]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveTitle();
      }
      if (e.key === 'Escape') {
        setEditing(false);
      }
    },
    [saveTitle],
  );

  const handleEditValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value);
  }, []);

  const handleClick = useCallback(() => {
    if (!editing) onOpenChat(session.characterAvatar, session.chatFile);
  }, [editing, onOpenChat, session.characterAvatar, session.chatFile]);

  const handleSaveMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      saveTitle();
    },
    [saveTitle],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(session);
    },
    [onDelete, session],
  );

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const displayTitle = session.title || t('chatList.newChat');

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--color-surface)] transition-colors cursor-pointer text-left w-full group/chat"
    >
      <div className="flex flex-col items-center flex-shrink-0 w-11">
        <div className="w-11 h-11 rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)]">
          {session.characterAvatar && session.characterAvatar !== '_no_character_' ? (
            <img
              src={`/characters/${session.characterAvatar}`}
              alt=""
              className="w-full h-full object-cover"
              onError={hideOnImageError}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MessageCircle size={18} className="text-[var(--color-text-muted)]" />
            </div>
          )}
        </div>
        <span className="text-[9px] text-[var(--color-text-muted)] truncate w-full text-center mt-0.5 leading-tight">
          {session.characterName || t('chatList.freeChat')}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          {editing ? (
            <TitleEdit
              inputRef={inputRef}
              value={editValue}
              placeholder={t('chatList.titlePlaceholder')}
              onChange={handleEditValueChange}
              onKeyDown={handleKeyDown}
              onBlur={saveTitle}
              onSaveMouseDown={handleSaveMouseDown}
              onClick={stopPropagation}
            />
          ) : (
            <TitleDisplay title={displayTitle} renameTooltip={t('common.rename')} onStartEditing={startEditing} />
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {formatRelativeDate(session.lastActiveAt)}
            </span>
            <button
              onClick={handleDeleteClick}
              className="opacity-0 group-hover/chat:opacity-100 p-0.5 rounded hover:bg-[var(--color-danger)]/15 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all cursor-pointer"
              title={t('chatList.deleteTooltip')}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[12px] text-[var(--color-text-muted)] truncate">
            {session.lastMessagePreview || t('chatList.noMessages')}
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
});
