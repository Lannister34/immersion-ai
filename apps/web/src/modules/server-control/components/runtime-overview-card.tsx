import type { RuntimeOverviewResponse } from '@immersion/contracts/runtime';

import { SummaryCard } from '../../../shared/ui/summary-card';

function formatRuntimeStatus(status: RuntimeOverviewResponse['serverStatus']['status']) {
  switch (status) {
    case 'running':
      return 'Запущен';
    case 'starting':
      return 'Запускается';
    case 'stopping':
      return 'Останавливается';
    case 'error':
      return 'Ошибка';
    default:
      return 'Не запущен';
  }
}

function renderOptionalValue(value: string | null) {
  return value && value.trim().length > 0 ? value : 'Не выбрана';
}

export function RuntimeOverviewCard({ overview }: { overview: RuntimeOverviewResponse }) {
  const visibleModels = overview.models.slice(0, 4);

  return (
    <SummaryCard
      eyebrow="runtime"
      title="Встроенный runtime"
      description="Текущее состояние локального runtime, конфигурации и найденных моделей."
    >
      <dl className="summary-list">
        <div className="summary-list__row">
          <dt>Статус</dt>
          <dd>{formatRuntimeStatus(overview.serverStatus.status)}</dd>
        </div>
        <div className="summary-list__row">
          <dt>Порт</dt>
          <dd>{overview.serverConfig.port}</dd>
        </div>
        <div className="summary-list__row">
          <dt>Текущая модель</dt>
          <dd>{renderOptionalValue(overview.serverStatus.model)}</dd>
        </div>
        <div className="summary-list__row">
          <dt>Найдено моделей</dt>
          <dd>{overview.models.length}</dd>
        </div>
        <div className="summary-list__row">
          <dt>KoboldCpp</dt>
          <dd>{overview.engine.found ? 'Найден' : 'Не найден'}</dd>
        </div>
      </dl>

      {overview.models.length > 0 ? (
        <ul className="capsule-list">
          {visibleModels.map((model) => (
            <li className="capsule-list__item" key={model.path}>
              <strong>{model.name}</strong>
              <span>{model.sourceDirectory}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="note">Подходящие модели пока не найдены в настроенных каталогах.</div>
      )}
    </SummaryCard>
  );
}
