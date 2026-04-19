import {
  type RuntimeConfigCommand,
  RuntimeConfigCommandSchema,
  type RuntimeInstallCommand,
  type RuntimeInstallVariant,
  type RuntimeModelSummary,
  type RuntimeOverviewResponse,
  type RuntimeServerStatus,
  type RuntimeStartCommand,
} from '@immersion/contracts/runtime';
import { useState } from 'react';

import { ApiError } from '../../../shared/api/client';

function formatModelSize(bytes: number) {
  const gib = bytes / 1024 ** 3;

  if (gib >= 1) {
    return `${gib.toFixed(1)} GB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

function getStatusLabel(status: RuntimeServerStatus) {
  switch (status) {
    case 'running':
      return 'Сервер запущен';
    case 'starting':
      return 'Модель загружается';
    case 'stopping':
      return 'Сервер останавливается';
    case 'error':
      return 'Ошибка запуска';
    case 'idle':
      return 'Сервер остановлен';
  }
}

function toModelsDirsText(modelsDirs: string[]) {
  return modelsDirs.join('\n');
}

function toModelsDirs(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

interface RuntimeControlPanelProps {
  isInstalling: boolean;
  isSavingConfig: boolean;
  isStarting: boolean;
  isStopping: boolean;
  onInstall: (command: RuntimeInstallCommand) => Promise<void>;
  onSaveConfig: (command: RuntimeConfigCommand) => Promise<void>;
  onStart: (command: RuntimeStartCommand) => Promise<void>;
  onStop: () => Promise<void>;
  overview: RuntimeOverviewResponse;
}

const runtimeInstallVariants: Array<{
  description: string;
  label: string;
  value: RuntimeInstallVariant;
}> = [
  {
    value: 'cpu',
    label: 'CPU',
    description: 'Самый совместимый вариант, работает без CUDA.',
  },
  {
    value: 'cuda-12.4',
    label: 'CUDA 12.4',
    description: 'Для NVIDIA-драйверов с поддержкой CUDA 12.x.',
  },
  {
    value: 'cuda-13.1',
    label: 'CUDA 13.1',
    description: 'Для новых NVIDIA-драйверов с поддержкой CUDA 13.x.',
  },
  {
    value: 'vulkan',
    label: 'Vulkan',
    description: 'Альтернатива CUDA для совместимых GPU.',
  },
];

interface RuntimeConfigDraft {
  contextSize: number;
  flashAttention: boolean;
  gpuLayers: number;
  modelsDirsText: string;
  port: number;
  threads: number;
}

function createDraft(config: RuntimeConfigCommand): RuntimeConfigDraft {
  return {
    contextSize: config.contextSize,
    flashAttention: config.flashAttention,
    gpuLayers: config.gpuLayers,
    modelsDirsText: toModelsDirsText(config.modelsDirs),
    port: config.port,
    threads: config.threads,
  };
}

function createCommand(draft: RuntimeConfigDraft): RuntimeConfigCommand {
  return RuntimeConfigCommandSchema.parse({
    modelsDirs: toModelsDirs(draft.modelsDirsText),
    port: draft.port,
    gpuLayers: draft.gpuLayers,
    contextSize: draft.contextSize,
    flashAttention: draft.flashAttention,
    threads: draft.threads,
  });
}

interface RuntimeModelRowProps {
  canStart: boolean;
  isLoaded: boolean;
  isStartingThisModel: boolean;
  model: RuntimeModelSummary;
  onStart: (model: RuntimeModelSummary) => Promise<void>;
}

function RuntimeModelRow({ canStart, isLoaded, isStartingThisModel, model, onStart }: RuntimeModelRowProps) {
  return (
    <li className={`model-row ${isLoaded ? 'model-row--current' : ''}`}>
      <div className="model-row__body">
        <strong>{model.name}</strong>
        <span>
          {formatModelSize(model.size)} · {model.sourceDirectory}
        </span>
      </div>

      {isLoaded ? <span className="model-row__badge">Загружена</span> : null}

      {!isLoaded ? (
        <button
          className="action-button action-button--compact"
          disabled={!canStart}
          onClick={() => onStart(model)}
          type="button"
        >
          {isStartingThisModel ? 'Запуск...' : 'Запустить'}
        </button>
      ) : null}
    </li>
  );
}

export function RuntimeControlPanel({
  isInstalling,
  isSavingConfig,
  isStarting,
  isStopping,
  onInstall,
  onSaveConfig,
  onStart,
  onStop,
  overview,
}: RuntimeControlPanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState(() => createDraft(overview.serverConfig));
  const [installVariant, setInstallVariant] = useState<RuntimeInstallVariant>('cpu');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const status = overview.serverStatus.status;
  const isTransitioning = status === 'starting' || status === 'stopping' || isStarting || isStopping;
  const currentModelPath = overview.serverStatus.modelPath;
  const isRunning = status === 'running';
  const canStartModels = overview.engine.found && !isTransitioning;

  const updateDraft = (patch: Partial<RuntimeConfigDraft>) => {
    setStatusMessage(null);
    setErrorMessage(null);
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  };

  const handleSaveConfig = async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await onSaveConfig(createCommand(draft));
      setStatusMessage('Параметры сервера сохранены.');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Не удалось сохранить параметры сервера.');
    }
  };

  const handleStart = async (model: RuntimeModelSummary) => {
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const config = createCommand(draft);
      await onStart({
        modelPath: model.path,
        port: config.port,
        gpuLayers: config.gpuLayers,
        contextSize: config.contextSize,
        flashAttention: config.flashAttention,
        threads: config.threads,
      });
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Не удалось запустить модель.');
    }
  };

  const handleStop = async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await onStop();
      setStatusMessage('Сервер остановлен.');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Не удалось остановить сервер.');
    }
  };

  const handleInstall = async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await onInstall({
        variant: installVariant,
      });
      setStatusMessage('llama-server установлен.');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Не удалось установить llama-server.');
    }
  };

  return (
    <section className="panel server-card">
      <div className="server-toolbar">
        <div className="runtime-status">
          <span className={`runtime-status__dot runtime-status__dot--${status}`} />
          <div>
            <strong>{getStatusLabel(status)}</strong>
            <span>
              {overview.serverStatus.pid ? `PID ${overview.serverStatus.pid}` : `Порт ${overview.serverStatus.port}`}
            </span>
          </div>
        </div>

        <div className="actions">
          <button className="ghost-button" onClick={() => setShowSettings((value) => !value)} type="button">
            {showSettings ? 'Скрыть параметры' : 'Параметры'}
          </button>
          <button
            className="ghost-button"
            disabled={status === 'idle' || isStopping}
            onClick={handleStop}
            type="button"
          >
            {isStopping ? 'Остановка...' : 'Остановить'}
          </button>
        </div>
      </div>

      {!overview.engine.found ? (
        <div className="install-panel">
          <div className="install-panel__message">
            <strong>llama-server не найден</strong>
            <span>Установите локальный сервер, чтобы запускать `.gguf` модели из приложения.</span>
          </div>

          <label className="field install-panel__variant">
            <span className="field__label">Версия</span>
            <select
              className="field__input"
              onChange={(event) => setInstallVariant(event.target.value as RuntimeInstallVariant)}
              value={installVariant}
            >
              {runtimeInstallVariants.map((variant) => (
                <option key={variant.value} value={variant.value}>
                  {variant.label}
                </option>
              ))}
            </select>
            <span className="field__hint">
              {runtimeInstallVariants.find((variant) => variant.value === installVariant)?.description}
            </span>
          </label>

          <button className="action-button" disabled={isInstalling} onClick={handleInstall} type="button">
            {isInstalling ? 'Установка...' : 'Установить'}
          </button>
        </div>
      ) : null}

      {overview.serverStatus.error ? <div className="note note--danger">{overview.serverStatus.error}</div> : null}

      {showSettings ? (
        <div className="runtime-settings">
          <label className="field field--span">
            <span className="field__label">Папки моделей</span>
            <textarea
              className="field__input field__input--textarea"
              onChange={(event) => updateDraft({ modelsDirsText: event.target.value })}
              rows={Math.max(2, draft.modelsDirsText.split(/\r?\n/).length)}
              value={draft.modelsDirsText}
            />
          </label>

          <label className="field">
            <span className="field__label">GPU layers</span>
            <input
              className="field__input"
              min={0}
              onChange={(event) => updateDraft({ gpuLayers: Number(event.target.value) })}
              type="number"
              value={draft.gpuLayers}
            />
          </label>

          <label className="field">
            <span className="field__label">Context size</span>
            <input
              className="field__input"
              min={512}
              onChange={(event) => updateDraft({ contextSize: Number(event.target.value) })}
              step={512}
              type="number"
              value={draft.contextSize}
            />
          </label>

          <label className="field">
            <span className="field__label">Threads</span>
            <input
              className="field__input"
              min={0}
              onChange={(event) => updateDraft({ threads: Number(event.target.value) })}
              type="number"
              value={draft.threads}
            />
          </label>

          <label className="field">
            <span className="field__label">Порт</span>
            <input
              className="field__input"
              min={1024}
              onChange={(event) => updateDraft({ port: Number(event.target.value) })}
              type="number"
              value={draft.port}
            />
          </label>

          <label className="checkbox-field">
            <input
              checked={draft.flashAttention}
              onChange={(event) => updateDraft({ flashAttention: event.target.checked })}
              type="checkbox"
            />
            Flash Attention
          </label>

          <div className="actions field--span">
            <button className="action-button" disabled={isSavingConfig} onClick={handleSaveConfig} type="button">
              {isSavingConfig ? 'Сохранение...' : 'Сохранить параметры'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="model-list-header">
        <h2>Модели</h2>
        <span>{overview.models.length > 0 ? `${overview.models.length} найдено` : 'Нет доступных моделей'}</span>
      </div>

      {overview.models.length > 0 ? (
        <ul className="model-list">
          {overview.models.map((model) => (
            <RuntimeModelRow
              canStart={canStartModels}
              isLoaded={isRunning && currentModelPath === model.path}
              isStartingThisModel={status === 'starting' && currentModelPath === model.path}
              key={model.path}
              model={model}
              onStart={handleStart}
            />
          ))}
        </ul>
      ) : (
        <div className="empty-state">Модели не найдены. Добавьте папку с `.gguf` в параметрах сервера.</div>
      )}

      {statusMessage ? <span className="form-status">{statusMessage}</span> : null}
      {errorMessage ? <span className="form-status form-status--error">{errorMessage}</span> : null}
    </section>
  );
}
