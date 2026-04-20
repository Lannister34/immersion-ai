import type { ChatSessionDto } from '@immersion/contracts/chats';

interface ChatSessionPanelProps {
  session: ChatSessionDto;
}

export function ChatSessionPanel({ session }: ChatSessionPanelProps) {
  return (
    <section className="panel chat-session-panel">
      <header className="chat-session-header">
        <div>
          <h1 className="panel__title">{session.chat.title}</h1>
          <p className="chat-session-header__meta">
            {session.characterName ?? 'Свободный чат'} · {session.chat.messageCount} сообщений
          </p>
        </div>
      </header>

      <div className="chat-transcript" aria-label="Сообщения">
        {session.messages.length > 0 ? (
          <ol className="message-list">
            {session.messages.map((message) => (
              <li className={`message-list__item message-list__item--${message.role}`} key={message.id}>
                <p>{message.content}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="note">В этом чате пока нет сообщений.</div>
        )}
      </div>
    </section>
  );
}
