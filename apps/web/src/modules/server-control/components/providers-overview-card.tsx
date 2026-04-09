import type { ProvidersOverviewResponse } from '@immersion/contracts/providers';

import { SummaryCard } from '../../../shared/ui/summary-card';

function formatMode(mode: ProvidersOverviewResponse['backendMode']) {
  return mode === 'builtin' ? 'Встроенный' : 'Внешний';
}

function getConfiguredFieldCount(overview: ProvidersOverviewResponse) {
  return overview.providerConfigs.reduce(
    (count, config) => count + config.fields.filter((field) => field.hasValue).length,
    0,
  );
}

export function ProvidersOverviewCard({ overview }: { overview: ProvidersOverviewResponse }) {
  const configuredFieldCount = getConfiguredFieldCount(overview);
  const providerLabels = new Map(overview.availableProviders.map((provider) => [provider.type, provider.label]));

  return (
    <SummaryCard
      eyebrow="провайдер"
      title="Сводка подключения"
      description="Текущий режим backend, активный провайдер и сохранённые значения подключения."
    >
      <dl className="summary-list">
        <div className="summary-list__row">
          <dt>Режим</dt>
          <dd>{formatMode(overview.backendMode)}</dd>
        </div>
        <div className="summary-list__row">
          <dt>Активный провайдер</dt>
          <dd>{providerLabels.get(overview.activeProvider) ?? overview.activeProvider}</dd>
        </div>
        <div className="summary-list__row">
          <dt>Доступно провайдеров</dt>
          <dd>{overview.availableProviders.length}</dd>
        </div>
        <div className="summary-list__row">
          <dt>Заполнено полей</dt>
          <dd>{configuredFieldCount}</dd>
        </div>
      </dl>

      <ul className="capsule-list">
        {overview.providerConfigs.map((config) => {
          const configuredFields = config.fields.filter((field) => field.hasValue).length;
          const label = providerLabels.get(config.provider) ?? config.provider;

          return (
            <li className="capsule-list__item" key={config.provider}>
              <strong>{label}</strong>
              <span>{configuredFields > 0 ? `${configuredFields} полей настроено` : 'не настроен'}</span>
            </li>
          );
        })}
      </ul>
    </SummaryCard>
  );
}
