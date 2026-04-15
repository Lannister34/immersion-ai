import type { ChatSummaryDto } from '@immersion/contracts/chats';
import { Link } from '@tanstack/react-router';

interface ChatListPanelProps {
  chats: ChatSummaryDto[];
}

export function ChatListPanel({ chats }: ChatListPanelProps) {
  if (chats.length === 0) {
    return (
      <section className="panel empty-state">
        <h2>Чатов пока нет</h2>
        <p>Создайте первую сессию, и она появится здесь.</p>
      </section>
    );
  }

  return (
    <section className="chat-list-panel" aria-label="Список чатов">
      {chats.map((chat) => (
        <Link className="chat-list-item" key={chat.id} params={{ chatId: chat.id }} to="/chat/$chatId">
          <div className="chat-list-item__avatar" aria-hidden="true">
            Ч
          </div>
          <div className="chat-list-item__body">
            <div className="chat-list-item__header">
              <strong>{chat.title}</strong>
              <span>{new Date(chat.updatedAt).toLocaleString('ru-RU')}</span>
            </div>
            <p>{chat.lastMessagePreview ?? 'Сообщений пока нет.'}</p>
          </div>
          {chat.messageCount > 0 ? <span className="chat-list-item__count">{chat.messageCount}</span> : null}
        </Link>
      ))}
    </section>
  );
}
