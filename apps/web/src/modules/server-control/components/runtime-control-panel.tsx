import {
  type RuntimeConfigCommand,
  RuntimeConfigCommandSchema,
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
  isSavingConfig: boolean;
  isStarting: boolean;
  isStopping: boolean;
  onSaveConfig: (command: RuntimeConfigCommand) => Promise<void>;
  onStart: (command: RuntimeStartCommand) => Promise<void>;
  onStop: () => Promise<void>;
  overview: RuntimeOverviewResponse;
}

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
  isCurrent: boolean;
  isStarting: boolean;
  model: RuntimeModelSummary;
  onStart: (model: RuntimeModelSummary) => Promise<void>;
}

function RuntimeModelRow({ canStart, isCurrent, isStarting, model, onStart }: RuntimeModelRowProps) {
  return (
    <li className={`model-row ${isCurrent ? 'model-row--current' : ''}`}>
      <div className="model-row__body">
        <strong>{model.name}</strong>
        <span>
          {formatModelSize(model.size)} · {model.sourceDirectory}
        </span>
      </div>

      {isCurrent ? <span className="model-row__badge">Загружена</span> : null}

      <button
        className="action-button action-button--compact"
        disabled={!canStart || isStarting}
        onClick={() => onStart(model)}
        type="button"
      >
        {isStarting ? 'Запуск...' : 'Запустить'}
      </button>
    </li>
  );
}

export function RuntimeControlPanel({
  isSavingConfig,
  isStarting,
  isStopping,
  onSaveConfig,
  onStart,
  onStop,
  overview,
}: RuntimeControlPanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState(() => createDraft(overview.serverConfig));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const status = overview.serverStatus.status;
  const isTransitioning = status === 'starting' || status === 'stopping' || isStarting || isStopping;
  const currentModelPath = overview.serverStatus.modelPath;
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
      setStatusMessage(`Запускаем ${model.name}.`);
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
        <div className="note note--danger">
          `llama-server` не найден. Положите бинарник в папку `bin/` проекта или установите llama.cpp перед запуском
          встроенного сервера.
        </div>
      ) : null}

      {overview.serverStatus.model && status === 'running' ? (
        <div className="current-model">
          <span>Текущая модель</span>
          <strong>{overview.serverStatus.model}</strong>
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
              isCurrent={currentModelPath === model.path}
              isStarting={isStarting || status === 'starting'}
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
