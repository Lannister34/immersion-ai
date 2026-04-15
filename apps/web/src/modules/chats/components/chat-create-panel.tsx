import { useState } from 'react';

interface ChatCreatePanelProps {
  isCreating: boolean;
  onCreate: (title: string | undefined) => Promise<void>;
}

export function ChatCreatePanel({ isCreating, onCreate }: ChatCreatePanelProps) {
  const [title, setTitle] = useState('');

  return (
    <section className="panel chat-create-panel">
      <div>
        <h1 className="panel__title">Создать чат</h1>
        <p className="panel__description">Новая свободная сессия без персонажа и сценария.</p>
      </div>

      <form
        className="chat-create-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const trimmedTitle = title.trim();
          await onCreate(trimmedTitle.length > 0 ? trimmedTitle : undefined);
          setTitle('');
        }}
      >
        <label className="field chat-create-form__field">
          <span className="field__label">Название чата</span>
          <input
            className="field__input"
            disabled={isCreating}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например, тестовый диалог"
            value={title}
          />
        </label>
        <button className="action-button" disabled={isCreating} type="submit">
          {isCreating ? 'Создание...' : 'Создать чат'}
        </button>
      </form>
    </section>
  );
}
