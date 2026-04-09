import { useState } from 'react';

interface ChatCreatePanelProps {
  isCreating: boolean;
  onCreate: (title: string | undefined) => Promise<void>;
}

export function ChatCreatePanel({ isCreating, onCreate }: ChatCreatePanelProps) {
  const [title, setTitle] = useState('');

  return (
    <section className="panel panel--hero">
      <div className="panel__eyebrow">новый чат</div>
      <h1 className="panel__title">Создать чат</h1>
      <p className="panel__description">
        Создайте новую сессию, чтобы сразу перейти в её экран и работать с ней как с отдельным ресурсом.
      </p>

      <form
        className="form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          const trimmedTitle = title.trim();
          await onCreate(trimmedTitle.length > 0 ? trimmedTitle : undefined);
          setTitle('');
        }}
      >
        <label className="field field--span">
          <span className="field__label">Название чата</span>
          <input
            className="field__input"
            disabled={isCreating}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например, Тестовый диалог"
            value={title}
          />
        </label>
        <div className="actions">
          <button className="action-button" disabled={isCreating} type="submit">
            {isCreating ? 'Создание...' : 'Создать чат'}
          </button>
        </div>
      </form>
    </section>
  );
}
