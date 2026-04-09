import { useState } from 'react';

interface ChatCreatePanelProps {
  isCreating: boolean;
  onCreate: (title: string | undefined) => Promise<void>;
}

export function ChatCreatePanel({ isCreating, onCreate }: ChatCreatePanelProps) {
  const [title, setTitle] = useState('');

  return (
    <section className="panel">
      <div className="panel__eyebrow">старт чата</div>
      <h1 className="panel__title">Создать новый чат</h1>
      <p className="panel__description">
        Первый MVP-срез уже хранит rewrite-чаты канонически на backend. Здесь можно создать generic chat и сразу открыть
        его через route-driven session view.
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
