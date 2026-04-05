import { useQuery } from '@tanstack/react-query';

import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';
import { RouteStatusScreen } from '../../shared/ui/route-status-screen';
import { SummaryCard } from '../../shared/ui/summary-card';
import { getSettingsOverview } from './api/get-settings-overview';

function renderBoolean(value: boolean) {
  return value ? 'Включено' : 'Выключено';
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
        title="Настройки"
        description="Загрузка канонического snapshot настроек из backend. Редактирование придёт отдельными typed mutation-срезами без возврата frontend ownership."
      />
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <RouteStatusScreen
        eyebrow="настройки"
        title="Не удалось загрузить настройки"
        description="Экран уже опирается на backend-owned read model. Проверьте rewrite API и состояние source-файлов."
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
      <PlaceholderScreen
        eyebrow="настройки"
        title="Настройки"
        description="Этот экран уже читает канонические настройки с backend. Формы профиля, prompt editing, toggles и sampler CRUD придут следующими отдельными срезами."
      />

      <div className="overview-grid">
        <SummaryCard
          eyebrow="профиль"
          title="Пользователь и поведение"
          description="Канонический snapshot file-backed user settings."
        >
          <dl className="summary-list">
            <div className="summary-list__row">
              <dt>Имя</dt>
              <dd>{profile.userName || 'User'}</dd>
            </div>
            <div className="summary-list__row">
              <dt>Персона</dt>
              <dd>{profile.userPersona ? 'Задана' : 'Пусто'}</dd>
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
              <dt>Thinking</dt>
              <dd>{renderBoolean(profile.thinkingEnabled)}</dd>
            </div>
          </dl>
        </SummaryCard>

        <SummaryCard
          eyebrow="prompt"
          title="Системный шаблон"
          description="Пока здесь только read-only preview, чтобы не тащить формы поверх незавершённых boundaries."
        >
          <p className="summary-card__mono">{promptPreview.slice(0, 420)}</p>
        </SummaryCard>

        <SummaryCard
          eyebrow="семплеры"
          title="Sampler presets"
          description="CRUD для presets и model bindings пойдёт отдельным typed sub-slice."
        >
          <dl className="summary-list">
            <div className="summary-list__row">
              <dt>Активный preset</dt>
              <dd>{activePreset?.name ?? sampler.activePresetId}</dd>
            </div>
            <div className="summary-list__row">
              <dt>Количество presets</dt>
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
