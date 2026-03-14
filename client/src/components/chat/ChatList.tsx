import { AlertTriangle, Check, MessageCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatRelativeDate } from '@/lib/dateFormatting';
import { useAppStore } from '@/stores';
import type { ChatSessionMeta } from '@/types';

// ── Chat List Item ──────────────────────────────────────────────────────────

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

// ── Chat List ───────────────────────────────────────────────────────────────

interface ChatListProps {
  onOpenChat: (avatar: string, chatFile: string) => void;
  onNewChat: () => void;
}

export function ChatList({ onOpenChat, onNewChat }: ChatListProps): JSX.Element {
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
