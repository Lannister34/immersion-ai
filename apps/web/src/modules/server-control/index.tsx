import type {
  ProviderMode,
  ProviderSettingsSnapshot,
  UpdateProviderSettingsCommand,
} from '@immersion/contracts/providers';
import type { RuntimeConfigCommand, RuntimeOverviewResponse, RuntimeStartCommand } from '@immersion/contracts/runtime';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';
import { RouteStatusScreen } from '../../shared/ui/route-status-screen';
import { getRuntimeOverview } from './api/get-runtime-overview';
import { saveProviderSettings } from './api/save-provider-settings';
import { saveRuntimeConfig } from './api/save-runtime-config';
import { startRuntime } from './api/start-runtime';
import { stopRuntime } from './api/stop-runtime';
import { ProviderSettingsForm } from './components/provider-settings-form';
import { RuntimeControlPanel } from './components/runtime-control-panel';
import { providerSettingsQueryKey, providerSettingsQueryOptions } from './queries/provider-settings-query';

function toProviderCommand(snapshot: ProviderSettingsSnapshot, mode: ProviderMode): UpdateProviderSettingsCommand {
  return {
    mode,
    activeProvider: snapshot.activeProvider,
    providerConfigs: snapshot.providerConfigs,
  };
}

export function ServerControlScreen() {
  const queryClient = useQueryClient();
  const providerSettingsQuery = useQuery(providerSettingsQueryOptions());
  const runtimeOverviewQuery = useQuery({
    queryKey: ['runtime', 'overview'],
    queryFn: getRuntimeOverview,
    refetchInterval: 2500,
  });
  const saveProviderMutation = useMutation({
    mutationFn: saveProviderSettings,
    onSuccess: async (snapshot) => {
      queryClient.setQueryData(providerSettingsQueryKey, snapshot);
      await queryClient.invalidateQueries({
        queryKey: ['providers', 'overview'],
      });
    },
  });
  const saveRuntimeConfigMutation = useMutation({
    mutationFn: saveRuntimeConfig,
    onSuccess: (overview: RuntimeOverviewResponse) => {
      queryClient.setQueryData(['runtime', 'overview'], overview);
    },
  });
  const startRuntimeMutation = useMutation({
    mutationFn: startRuntime,
    onSuccess: (overview: RuntimeOverviewResponse) => {
      queryClient.setQueryData(['runtime', 'overview'], overview);
    },
  });
  const stopRuntimeMutation = useMutation({
    mutationFn: stopRuntime,
    onSuccess: (overview: RuntimeOverviewResponse) => {
      queryClient.setQueryData(['runtime', 'overview'], overview);
    },
  });

  if (providerSettingsQuery.isLoading) {
    return <PlaceholderScreen eyebrow="бэкенд" title="Загрузка настроек" description="Проверяем режим подключения." />;
  }

  if (providerSettingsQuery.isError || !providerSettingsQuery.data) {
    return (
      <RouteStatusScreen
        eyebrow="бэкенд"
        title="Не удалось загрузить настройки"
        description="Проверьте rewrite API и повторите попытку."
      />
    );
  }

  const snapshot = providerSettingsQuery.data;
  const activeMode = snapshot.mode;

  const handleModeChange = async (mode: ProviderMode) => {
    if (mode === activeMode || saveProviderMutation.isPending) {
      return;
    }

    await saveProviderMutation.mutateAsync(toProviderCommand(snapshot, mode));
  };

  const handleExternalSubmit = async (command: UpdateProviderSettingsCommand) => {
    await saveProviderMutation.mutateAsync(command);
  };

  const handleRuntimeConfigSave = async (command: RuntimeConfigCommand) => {
    await saveRuntimeConfigMutation.mutateAsync(command);
  };

  const handleRuntimeStart = async (command: RuntimeStartCommand) => {
    await startRuntimeMutation.mutateAsync(command);
  };

  const handleRuntimeStop = async () => {
    await stopRuntimeMutation.mutateAsync();
  };

  let serverContent: ReactNode;

  if (activeMode === 'builtin' && runtimeOverviewQuery.data) {
    serverContent = (
      <RuntimeControlPanel
        isSavingConfig={saveRuntimeConfigMutation.isPending}
        isStarting={startRuntimeMutation.isPending}
        isStopping={stopRuntimeMutation.isPending}
        key={JSON.stringify(runtimeOverviewQuery.data.serverConfig)}
        onSaveConfig={handleRuntimeConfigSave}
        onStart={handleRuntimeStart}
        onStop={handleRuntimeStop}
        overview={runtimeOverviewQuery.data}
      />
    );
  } else if (activeMode === 'builtin') {
    serverContent = (
      <RouteStatusScreen
        eyebrow="встроенный сервер"
        title={runtimeOverviewQuery.isError ? 'Не удалось загрузить runtime' : 'Загрузка runtime'}
        description={
          runtimeOverviewQuery.isError
            ? 'Проверьте rewrite API и состояние встроенного сервера.'
            : 'Получаем список моделей и состояние сервера.'
        }
      />
    );
  } else {
    serverContent = (
      <ProviderSettingsForm
        isSaving={saveProviderMutation.isPending}
        onSubmit={handleExternalSubmit}
        snapshot={snapshot}
      />
    );
  }

  return (
    <div className="stack">
      <section className="panel server-card">
        <div className="server-header">
          <h1 className="panel__title">Бэкенд</h1>
          <div aria-label="Режим backend" className="segmented" role="group">
            <button
              aria-pressed={activeMode === 'builtin'}
              className={`segmented__button ${activeMode === 'builtin' ? 'segmented__button--active' : ''}`}
              disabled={saveProviderMutation.isPending}
              onClick={() => void handleModeChange('builtin')}
              type="button"
            >
              Встроенный сервер
            </button>
            <button
              aria-pressed={activeMode === 'external'}
              className={`segmented__button ${activeMode === 'external' ? 'segmented__button--active' : ''}`}
              disabled={saveProviderMutation.isPending}
              onClick={() => void handleModeChange('external')}
              type="button"
            >
              Внешний API
            </button>
          </div>
        </div>
      </section>

      {serverContent}
    </div>
  );
}
