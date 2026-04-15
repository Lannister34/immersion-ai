import { useId, useState } from 'react';

interface ChatComposerPanelProps {
  isSending: boolean;
  onSend: (message: string) => Promise<void>;
  sendBlockReason: string | undefined;
}

export function ChatComposerPanel({ isSending, onSend, sendBlockReason }: ChatComposerPanelProps) {
  const blockReasonId = useId();
  const [message, setMessage] = useState('');
  const trimmedMessage = message.trim();
  const isSendBlocked = sendBlockReason !== undefined;
  const isSubmitDisabled = isSending || isSendBlocked || trimmedMessage.length === 0;
  const sendButtonTitle = !isSending && isSendBlocked ? sendBlockReason : undefined;

  return (
    <section className="panel composer-panel" aria-label="Композитор чата">
      <form
        className="composer-form"
        onSubmit={async (event) => {
          event.preventDefault();

          if (isSubmitDisabled) {
            return;
          }

          await onSend(trimmedMessage);
          setMessage('');
        }}
      >
        <label className="field">
          <span className="field__label sr-only">Сообщение</span>
          <textarea
            className="field__input field__input--textarea composer-form__input"
            disabled={isSending}
            maxLength={20_000}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Напишите сообщение для модели..."
            value={message}
          />
        </label>
        <div className="actions composer-form__actions">
          {sendBlockReason ? (
            <span className="sr-only" id={blockReasonId}>
              {sendBlockReason}
            </span>
          ) : null}
          <span className="composer-form__send-control" title={sendButtonTitle}>
            <button
              aria-describedby={sendBlockReason ? blockReasonId : undefined}
              className="action-button"
              disabled={isSubmitDisabled}
              title={sendButtonTitle}
              type="submit"
            >
              {isSending ? 'Генерация...' : 'Отправить'}
            </button>
          </span>
        </div>
      </form>
    </section>
  );
}
