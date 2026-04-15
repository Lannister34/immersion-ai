import { useState } from 'react';

interface ChatComposerPanelProps {
  disabledMessage: string | undefined;
  isDisabled: boolean;
  isSending: boolean;
  onSend: (message: string) => Promise<void>;
}

export function ChatComposerPanel({ disabledMessage, isDisabled, isSending, onSend }: ChatComposerPanelProps) {
  const [message, setMessage] = useState('');
  const trimmedMessage = message.trim();
  const isComposerDisabled = isSending || isDisabled;

  return (
    <section className="panel composer-panel" aria-label="Композитор чата">
      <form
        className="composer-form"
        onSubmit={async (event) => {
          event.preventDefault();

          if (trimmedMessage.length === 0 || isComposerDisabled) {
            return;
          }

          await onSend(trimmedMessage);
          setMessage('');
        }}
      >
        <label className="field">
          <span className="field__label">Сообщение</span>
          <textarea
            className="field__input field__input--textarea composer-form__input"
            disabled={isComposerDisabled}
            maxLength={20_000}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Напишите сообщение для модели..."
            value={message}
          />
        </label>
        {disabledMessage && !isSending ? <p className="composer-form__status">{disabledMessage}</p> : null}
        <div className="actions composer-form__actions">
          <button className="action-button" disabled={isComposerDisabled || trimmedMessage.length === 0} type="submit">
            {isSending ? 'Генерация...' : 'Отправить'}
          </button>
        </div>
      </form>
    </section>
  );
}
