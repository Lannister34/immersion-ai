import type { ChatSessionDto } from '@immersion/contracts/chats';

import { SummaryCard } from '../../../shared/ui/summary-card';

interface ChatSessionPanelProps {
  session: ChatSessionDto;
}

function getMessageRoleLabel(role: ChatSessionDto['messages'][number]['role']) {
  if (role === 'user') {
    return 'Пользователь';
  }

  if (role === 'assistant') {
    return 'Модель';
  }

  return 'Система';
}

export function ChatSessionPanel({ session }: ChatSessionPanelProps) {
  return (
    <div className="stack">
      <section className="panel">
        <div className="panel__eyebrow">сессия</div>
        <h1 className="panel__title">{session.chat.title}</h1>
        <p className="panel__description">
          Этот экран уже читает каноническую session snapshot с backend. Следующий срез добавит append user message и
          provider-backed generation.
        </p>
        <dl className="summary-list">
          <div className="summary-list__row">
            <dt>ID</dt>
            <dd className="summary-card__mono">{session.chat.id}</dd>
          </div>
          <div className="summary-list__row">
            <dt>Пользователь</dt>
            <dd>{session.userName}</dd>
          </div>
          <div className="summary-list__row">
            <dt>Сообщения</dt>
            <dd>{session.chat.messageCount}</dd>
          </div>
          <div className="summary-list__row">
            <dt>Создан</dt>
            <dd>{new Date(session.chat.createdAt).toLocaleString('ru-RU')}</dd>
          </div>
          <div className="summary-list__row">
            <dt>Обновлён</dt>
            <dd>{new Date(session.chat.updatedAt).toLocaleString('ru-RU')}</dd>
          </div>
        </dl>
      </section>

      <SummaryCard
        eyebrow="transcript"
        title="Сообщения"
        description="Read-only transcript из канонического chat file. Composer и generation появятся следующим отдельным срезом."
      >
        {session.messages.length > 0 ? (
          <ol className="message-list">
            {session.messages.map((message) => (
              <li className={`message-list__item message-list__item--${message.role}`} key={message.id}>
                <div className="message-list__meta">
                  <strong>{getMessageRoleLabel(message.role)}</strong>
                  <span>{new Date(message.createdAt).toLocaleString('ru-RU')}</span>
                </div>
                <p>{message.content}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="note">
            Сообщений пока нет. Этот чат уже существует на диске, но generation loop ещё не подключён.
          </div>
        )}
      </SummaryCard>
    </div>
  );
}
