import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';
import { RouteStatusScreen } from '../../shared/ui/route-status-screen';
import { saveProviderSettings } from './api/save-provider-settings';
import { ProviderSettingsForm } from './components/provider-settings-form';
import { RuntimePlaceholderCard } from './components/runtime-placeholder-card';
import { providerSettingsQueryKey, providerSettingsQueryOptions } from './queries/provider-settings-query';

export function ServerControlScreen() {
  const queryClient = useQueryClient();
  const providerSettingsQuery = useQuery(providerSettingsQueryOptions());
  const saveMutation = useMutation({
    mutationFn: saveProviderSettings,
    onSuccess: (snapshot) => {
      queryClient.setQueryData(providerSettingsQueryKey, snapshot);
    },
  });

  if (providerSettingsQuery.isLoading) {
    return (
      <PlaceholderScreen
        eyebrow="сервер"
        title="Сервер и провайдеры"
        description="Загрузка канонического provider settings snapshot из backend. Runtime control и model management придут отдельным срезом после стабилизации ownership."
      />
    );
  }

  if (providerSettingsQuery.isError || !providerSettingsQuery.data) {
    return (
      <RouteStatusScreen
        eyebrow="сервер"
        title="Не удалось загрузить настройки провайдера"
        description="Экран больше не зависит от frontend-owned shadow state и читает канонический backend snapshot напрямую. Проверьте rewrite API и состояние source-файлов."
      />
    );
  }

  const snapshot = providerSettingsQuery.data;

  return (
    <div className="stack">
      <PlaceholderScreen
        eyebrow="сервер"
        title="Сервер и провайдеры"
        description="Первый mutation-срез переносит только provider settings. Runtime status, model inventory, start/stop и логи остаются отдельным шагом, чтобы не смешивать ownership."
      />

      <ProviderSettingsForm
        isSaving={saveMutation.isPending}
        onSubmit={async (command) => {
          await saveMutation.mutateAsync(command);
        }}
        snapshot={snapshot}
      />

      <div className="overview-grid">
        <RuntimePlaceholderCard mode={snapshot.mode} />
      </div>
    </div>
  );
}
