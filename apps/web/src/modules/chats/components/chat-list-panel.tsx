import type { ChatSummaryDto } from '@immersion/contracts/chats';
import { Link } from '@tanstack/react-router';

import { SummaryCard } from '../../../shared/ui/summary-card';

interface ChatListPanelProps {
  chats: ChatSummaryDto[];
}

export function ChatListPanel({ chats }: ChatListPanelProps) {
  if (chats.length === 0) {
    return (
      <section className="panel">
        <div className="panel__eyebrow">список</div>
        <h2 className="panel__title panel__title--secondary">Чатов пока нет</h2>
        <p className="panel__description">
          Создайте первый generic chat. После этого этот экран станет канонической точкой входа для списка сессий.
        </p>
      </section>
    );
  }

  return (
    <section className="stack">
      {chats.map((chat) => (
        <Link className="chat-link" key={chat.id} params={{ chatId: chat.id }} to="/chat/$chatId">
          <SummaryCard
            eyebrow="чат"
            title={chat.title}
            description={chat.lastMessagePreview ?? 'Сообщений пока нет. Следующий срез добавит отправку и generation.'}
          >
            <dl className="summary-list">
              <div className="summary-list__row">
                <dt>ID</dt>
                <dd className="summary-card__mono">{chat.id}</dd>
              </div>
              <div className="summary-list__row">
                <dt>Сообщения</dt>
                <dd>{chat.messageCount}</dd>
              </div>
              <div className="summary-list__row">
                <dt>Обновлён</dt>
                <dd>{new Date(chat.updatedAt).toLocaleString('ru-RU')}</dd>
              </div>
            </dl>
          </SummaryCard>
        </Link>
      ))}
    </section>
  );
}
