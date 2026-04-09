import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';
import { RouteStatusScreen } from '../../shared/ui/route-status-screen';
import { SummaryCard } from '../../shared/ui/summary-card';
import { getProvidersOverview } from './api/get-providers-overview';
import { getRuntimeOverview } from './api/get-runtime-overview';
import { saveProviderSettings } from './api/save-provider-settings';
import { ProviderSettingsForm } from './components/provider-settings-form';
import { ProvidersOverviewCard } from './components/providers-overview-card';
import { RuntimeOverviewCard } from './components/runtime-overview-card';
import { providerSettingsQueryKey, providerSettingsQueryOptions } from './queries/provider-settings-query';

export function ServerControlScreen() {
  const queryClient = useQueryClient();
  const providerSettingsQuery = useQuery(providerSettingsQueryOptions());
  const providersOverviewQuery = useQuery({
    queryKey: ['providers', 'overview'],
    queryFn: getProvidersOverview,
  });
  const runtimeOverviewQuery = useQuery({
    queryKey: ['runtime', 'overview'],
    queryFn: getRuntimeOverview,
  });
  const saveMutation = useMutation({
    mutationFn: saveProviderSettings,
    onSuccess: async (snapshot) => {
      queryClient.setQueryData(providerSettingsQueryKey, snapshot);
      await queryClient.invalidateQueries({
        queryKey: ['providers', 'overview'],
      });
    },
  });

  if (providerSettingsQuery.isLoading) {
    return (
      <PlaceholderScreen
        eyebrow="провайдеры"
        title="Загрузка подключения к LLM"
        description="Получаем текущую конфигурацию провайдера и состояние встроенного runtime."
      />
    );
  }

  if (providerSettingsQuery.isError || !providerSettingsQuery.data) {
    return (
      <RouteStatusScreen
        eyebrow="провайдеры"
        title="Не удалось загрузить настройки подключения"
        description="Проверьте rewrite API и состояние канонических файлов настроек."
      />
    );
  }

  const snapshot = providerSettingsQuery.data;

  return (
    <div className="stack">
      <section className="panel panel--hero">
        <div className="panel__eyebrow">провайдеры</div>
        <h1 className="panel__title">Подключение к LLM</h1>
        <p className="panel__description">
          Здесь настраивается источник ответов модели. Конфигурация сохраняется на backend и сразу становится
          канонической для приложения.
        </p>
      </section>

      <div className="overview-grid">
        {providersOverviewQuery.data ? (
          <ProvidersOverviewCard overview={providersOverviewQuery.data} />
        ) : (
          <SummaryCard
            eyebrow="провайдер"
            title="Сводка подключения"
            description={
              providersOverviewQuery.isError
                ? 'Не удалось загрузить обзор провайдеров.'
                : 'Загружаем обзор текущего подключения.'
            }
          >
            <div className="note">
              {providersOverviewQuery.isError
                ? 'Проверьте backend и повторите попытку.'
                : 'Данные появятся автоматически после ответа API.'}
            </div>
          </SummaryCard>
        )}

        {runtimeOverviewQuery.data ? (
          <RuntimeOverviewCard overview={runtimeOverviewQuery.data} />
        ) : (
          <SummaryCard
            eyebrow="runtime"
            title="Встроенный runtime"
            description={
              runtimeOverviewQuery.isError
                ? 'Не удалось загрузить состояние встроенного runtime.'
                : 'Загружаем состояние встроенного runtime.'
            }
          >
            <div className="note">
              {runtimeOverviewQuery.isError
                ? 'Проверьте runtime API и повторите попытку.'
                : 'Состояние и список моделей появятся после ответа API.'}
            </div>
          </SummaryCard>
        )}
      </div>

      <ProviderSettingsForm
        isSaving={saveMutation.isPending}
        onSubmit={async (command) => {
          await saveMutation.mutateAsync(command);
        }}
        snapshot={snapshot}
      />
    </div>
  );
}
