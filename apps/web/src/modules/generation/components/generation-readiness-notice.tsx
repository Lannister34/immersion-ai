import type { GenerationReadinessResponse } from '@immersion/contracts/generation';
import { Link } from '@tanstack/react-router';

interface GenerationReadinessNoticeProps {
  isError: boolean;
  isLoading: boolean;
  readiness: GenerationReadinessResponse | undefined;
}

function getRuntimeDescription(readiness: GenerationReadinessResponse) {
  if (!readiness.runtime) {
    return null;
  }

  const model = readiness.runtime.model ?? 'модель не выбрана';

  return `Runtime: ${readiness.runtime.status}, порт ${readiness.runtime.port}, ${model}.`;
}

export function GenerationReadinessNotice({ isError, isLoading, readiness }: GenerationReadinessNoticeProps) {
  if (isError) {
    return (
      <div className="note note--danger readiness-note" role="alert">
        <div>
          <strong>Генерация недоступна.</strong>
          <p>Не удалось проверить готовность LLM. Проверьте API и повторите попытку.</p>
        </div>
        <Link className="action-button action-button--compact action-button--link" to="/server">
          Открыть API
        </Link>
      </div>
    );
  }

  if (isLoading && !readiness) {
    return (
      <div className="note readiness-note" role="status">
        <div>
          <strong>Проверяем LLM.</strong>
          <p>Отправка сообщений станет доступна после проверки провайдера.</p>
        </div>
      </div>
    );
  }

  if (!readiness || readiness.status === 'ready') {
    return null;
  }

  const runtimeDescription = getRuntimeDescription(readiness);

  return (
    <div className="note note--danger readiness-note" role="alert">
      <div>
        <strong>Генерация недоступна.</strong>
        <p>{readiness.issue?.message ?? 'LLM не готова к генерации.'}</p>
        {runtimeDescription ? <p>{runtimeDescription}</p> : null}
      </div>
      <Link className="action-button action-button--compact action-button--link" to="/server">
        Открыть API
      </Link>
    </div>
  );
}
