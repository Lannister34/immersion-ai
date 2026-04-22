import type { ChatReplyPromptPreviewResponse } from '@immersion/contracts/generation';

interface ChatReplyPromptPreviewPanelProps {
  isError: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  preview: ChatReplyPromptPreviewResponse | undefined;
}

function formatSamplerSource(source: ChatReplyPromptPreviewResponse['effectiveSettings']['samplerPresetSource']) {
  if (source === 'chat_preset') {
    return 'пресет чата';
  }

  if (source === 'model_binding') {
    return 'привязка модели';
  }

  return 'активный пресет';
}

function formatPromptSource(source: ChatReplyPromptPreviewResponse['diagnostics']['promptSource']['kind']) {
  if (source === 'chat-override') {
    return 'системный промпт чата';
  }

  if (source === 'character-override') {
    return 'персонаж';
  }

  if (source === 'settings-template') {
    return 'глобальный шаблон';
  }

  return 'по умолчанию';
}

export function ChatReplyPromptPreviewPanel({
  isError,
  isLoading,
  isRefreshing,
  onRefresh,
  preview,
}: ChatReplyPromptPreviewPanelProps) {
  return (
    <details className="panel prompt-preview-panel">
      <summary className="prompt-preview-summary">
        <span>
          <strong>Контекст модели</strong>
          <small>Фактический payload перед генерацией</small>
        </span>
        <button
          className="ghost-button"
          disabled={isLoading || isRefreshing}
          onClick={(event) => {
            event.preventDefault();
            onRefresh();
          }}
          type="button"
        >
          {isRefreshing ? 'Обновляем...' : 'Обновить'}
        </button>
      </summary>

      {isLoading ? <div className="note">Готовим preview контекста модели.</div> : null}
      {isError ? (
        <div className="note note--danger">Не удалось собрать preview. Проверьте настройки чата и пресеты.</div>
      ) : null}
      {preview ? (
        <div className="prompt-preview">
          <dl className="prompt-preview-stats">
            <div>
              <dt>Модель</dt>
              <dd>{preview.provider.model ?? 'не определена'}</dd>
            </div>
            <div>
              <dt>Готовность</dt>
              <dd>{preview.provider.readiness.status === 'ready' ? 'готово' : 'заблокировано'}</dd>
            </div>
            <div>
              <dt>Системный prompt</dt>
              <dd>{preview.diagnostics.systemPromptIncluded ? 'включён' : 'нет'}</dd>
            </div>
            <div>
              <dt>Источник</dt>
              <dd>{formatPromptSource(preview.diagnostics.promptSource.kind)}</dd>
            </div>
            <div>
              <dt>Пресет</dt>
              <dd>
                {preview.effectiveSettings.samplerPresetName} ·{' '}
                {formatSamplerSource(preview.effectiveSettings.samplerPresetSource)}
              </dd>
            </div>
            <div>
              <dt>Сообщения</dt>
              <dd>
                {preview.diagnostics.messageCount}, system: {preview.diagnostics.systemMessageCount}
              </dd>
            </div>
            <div>
              <dt>Бюджет</dt>
              <dd>
                {preview.diagnostics.tokenEstimate.promptBudget} + {preview.diagnostics.tokenEstimate.replyReservation}
              </dd>
            </div>
            <div>
              <dt>Max tokens</dt>
              <dd>{preview.request.maxTokens}</dd>
            </div>
            <div>
              <dt>Обрезано</dt>
              <dd>{preview.diagnostics.trimmedMessageCount}</dd>
            </div>
          </dl>

          {preview.provider.readiness.issue ? (
            <div className="note">{preview.provider.readiness.issue.message}</div>
          ) : null}

          <ol className="prompt-preview-messages" aria-label="Сообщения payload">
            {preview.request.messages.length > 0 ? (
              preview.request.messages.map((message, index) => (
                <li className="prompt-preview-message" key={`${message.role}:${index}`}>
                  <strong>{message.role}</strong>
                  <pre>{message.content}</pre>
                </li>
              ))
            ) : (
              <li className="note">Payload пока пуст. Напишите сообщение в чат.</li>
            )}
          </ol>
        </div>
      ) : null}
    </details>
  );
}
