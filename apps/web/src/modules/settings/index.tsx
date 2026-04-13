import { useQuery } from '@tanstack/react-query';

import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';
import { RouteStatusScreen } from '../../shared/ui/route-status-screen';
import { SummaryCard } from '../../shared/ui/summary-card';
import { getSettingsOverview } from './api/get-settings-overview';

function renderBoolean(value: boolean) {
  return value ? 'Включено' : 'Выключено';
}

function renderOptionalText(value: string) {
  return value.trim().length > 0 ? value : 'Не задано';
}

export function SettingsScreen() {
  const settingsQuery = useQuery({
    queryKey: ['settings-overview'],
    queryFn: getSettingsOverview,
  });

  if (settingsQuery.isLoading) {
    return (
      <PlaceholderScreen
        eyebrow="настройки"
        title="Загрузка настроек"
        description="Получаем текущую конфигурацию профиля и системного шаблона."
      />
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <RouteStatusScreen
        eyebrow="настройки"
        title="Не удалось загрузить настройки"
        description="Проверьте доступность приложения и повторите попытку."
      />
    );
  }

  const { profile, sampler } = settingsQuery.data;
  const activePreset = sampler.presets.find((preset) => preset.id === sampler.activePresetId);
  const promptPreview = profile.systemPromptTemplate.trim()
    ? profile.systemPromptTemplate.trim()
    : 'Шаблон ещё не задан.';

  return (
    <div className="stack">
      <section className="panel panel--hero">
        <div className="panel__eyebrow">настройки</div>
        <h1 className="panel__title">Текущая конфигурация профиля</h1>
        <p className="panel__description">Профиль пользователя, системный шаблон и активный sampler preset.</p>
      </section>

      <div className="overview-grid">
        <SummaryCard
          eyebrow="профиль"
          title="Пользователь и поведение"
          description="Текущие значения, которые участвуют в prompt и работе интерфейса."
        >
          <dl className="summary-list">
            <div className="summary-list__row">
              <dt>Имя</dt>
              <dd>{renderOptionalText(profile.userName)}</dd>
            </div>
            <div className="summary-list__row">
              <dt>Персона</dt>
              <dd>{profile.userPersona ? 'Задана' : 'Не задана'}</dd>
            </div>
            <div className="summary-list__row">
              <dt>Язык UI</dt>
              <dd>{profile.uiLanguage.toUpperCase()}</dd>
            </div>
            <div className="summary-list__row">
              <dt>Язык ответов</dt>
              <dd>{profile.responseLanguage.toUpperCase()}</dd>
            </div>
            <div className="summary-list__row">
              <dt>Стриминг</dt>
              <dd>{renderBoolean(profile.streamingEnabled)}</dd>
            </div>
            <div className="summary-list__row">
              <dt>Размышления</dt>
              <dd>{renderBoolean(profile.thinkingEnabled)}</dd>
            </div>
          </dl>
        </SummaryCard>

        <SummaryCard eyebrow="prompt" title="Системный шаблон" description="Текущий шаблон для сборки prompt.">
          <p className="summary-card__mono">{promptPreview.slice(0, 420)}</p>
        </SummaryCard>

        <SummaryCard
          eyebrow="sampler"
          title="Активный preset"
          description="Текущая sampler-конфигурация и количество привязок к моделям."
        >
          <dl className="summary-list">
            <div className="summary-list__row">
              <dt>Preset</dt>
              <dd>{activePreset?.name ?? sampler.activePresetId}</dd>
            </div>
            <div className="summary-list__row">
              <dt>Всего presets</dt>
              <dd>{sampler.presets.length}</dd>
            </div>
            <div className="summary-list__row">
              <dt>Model bindings</dt>
              <dd>{sampler.modelBindingCount}</dd>
            </div>
          </dl>
        </SummaryCard>
      </div>
    </div>
  );
}
