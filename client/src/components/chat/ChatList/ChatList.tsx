import { AlertTriangle, MessageCircle, Plus, Search, Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ChatListItem } from './ChatListItem';
import { useChatList } from './useChatList';

interface ChatListProps {
  onOpenChat: (avatar: string, chatFile: string) => void;
  onNewChat: () => void;
}

export function ChatList({ onOpenChat, onNewChat }: ChatListProps): JSX.Element {
  const {
    search,
    loadingChats,
    deleteTarget,
    isDeleting,
    sortedSessions,
    handleSearchChange,
    handleDeleteConfirm,
    handleDeleteCancel,
    setDeleteTarget,
  } = useChatList();

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Поиск чатов..."
            value={search}
            onChange={handleSearchChange}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>
        <Button onClick={onNewChat}>
          <Plus size={15} />
          <span className="hidden sm:inline">Новый чат</span>
        </Button>
      </div>

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

      <Modal open={!!deleteTarget} onClose={handleDeleteCancel} title="Удаление чата" size="sm">
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
            <Button variant="secondary" onClick={handleDeleteCancel} disabled={isDeleting}>
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
