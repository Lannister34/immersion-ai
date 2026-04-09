import { Link } from '@tanstack/react-router';

export function StartChatPanel() {
  return (
    <section className="panel">
      <div className="panel__eyebrow">старт чата</div>
      <h2 className="panel__title panel__title--secondary">Первый рабочий MVP-поток</h2>
      <p className="panel__description">
        Переписанный shell уже умеет создавать generic chat session и открывать её как backend-owned ресурс. Персонажи,
        сценарии и generation пойдут отдельными следующими срезами.
      </p>
      <div className="actions">
        <Link className="action-button action-button--link" to="/chat">
          Открыть чаты
        </Link>
      </div>
    </section>
  );
}
