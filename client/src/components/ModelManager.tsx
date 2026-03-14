import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Download,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Loader2,
  Play,
  Settings,
  Square,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { EngineInfo, LlmServerStatus, ModelFile } from '@/api';
import { browseFolder, getEngineInfo, getLlmServerStatus, listModelFiles, startLlmServer, stopLlmServer } from '@/api';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores';

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

export function ModelManager() {
  const { llmServerConfig, setLlmServerConfig, setConnection } = useAppStore();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [browsing, setBrowsing] = useState(false);
  const prevStatusRef = useRef<string>('idle');

  // Check engine availability
  const { data: engineInfo } = useQuery<EngineInfo>({
    queryKey: ['engine-info'],
    queryFn: getEngineInfo,
    staleTime: 60_000,
  });

  // Set default modelsDir from engine info on first load
  useEffect(() => {
    if (engineInfo?.defaultModelsDir && !llmServerConfig.modelsDir) {
      setLlmServerConfig({ modelsDir: engineInfo.defaultModelsDir });
    }
  }, [engineInfo?.defaultModelsDir, llmServerConfig.modelsDir, setLlmServerConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll server status every 2s
  const { data: serverStatus } = useQuery<LlmServerStatus>({
    queryKey: ['llm-server-status'],
    queryFn: getLlmServerStatus,
    refetchInterval: 2000,
  });

  const status = serverStatus?.status ?? 'idle';

  // Effective modelsDir (from config or engine default)
  const effectiveModelsDir = llmServerConfig.modelsDir || engineInfo?.defaultModelsDir || '';

  // List model files
  const { data: modelFiles } = useQuery<ModelFile[]>({
    queryKey: ['model-files', effectiveModelsDir],
    queryFn: () => listModelFiles(effectiveModelsDir),
    enabled: !!effectiveModelsDir,
    staleTime: 30_000,
  });

  // Timer for loading state
  useEffect(() => {
    if (status === 'starting' && !startTime) {
      setStartTime(Date.now());
    } else if (status !== 'starting') {
      setStartTime(null);
      setElapsed(0);
    }
  }, [status, startTime]);

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Sync connection status when llm server transitions to running
  useEffect(() => {
    if (status === 'running' && prevStatusRef.current !== 'running') {
      setConnection({
        connected: true,
        model: serverStatus?.model ?? '',
      });
    } else if (status !== 'running' && prevStatusRef.current === 'running') {
      setConnection({ connected: false });
    }
    prevStatusRef.current = status;
  }, [status, serverStatus?.model, setConnection]);

  const handleStartModel = async (model: ModelFile) => {
    try {
      await startLlmServer({
        modelPath: model.path,
        port: llmServerConfig.port,
        gpuLayers: llmServerConfig.gpuLayers,
        contextSize: llmServerConfig.contextSize,
        flashAttention: llmServerConfig.flashAttention,
        threads: llmServerConfig.threads,
      });
      // Immediately refetch status after starting
      void queryClient.invalidateQueries({ queryKey: ['llm-server-status'] });
    } catch (err) {
      console.error('Failed to start LLM server:', err);
    }
  };

  const handleStop = async () => {
    try {
      await stopLlmServer();
      // Immediately refetch status after stopping
      void queryClient.invalidateQueries({ queryKey: ['llm-server-status'] });
    } catch (err) {
      console.error('Failed to stop LLM server:', err);
    }
  };

  const statusDot =
    status === 'running'
      ? 'bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]'
      : status === 'starting' || status === 'stopping'
        ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse'
        : status === 'error'
          ? 'bg-[var(--color-danger)] shadow-[0_0_8px_var(--color-danger)]'
          : 'bg-[var(--color-text-muted)]';

  const statusText =
    status === 'running'
      ? `Запущен${serverStatus?.pid ? ` (PID ${serverStatus.pid})` : ''}`
      : status === 'starting'
        ? `Загрузка модели... ${formatElapsed(elapsed)}`
        : status === 'stopping'
          ? 'Остановка...'
          : status === 'error'
            ? `Ошибка: ${serverStatus?.error ?? 'неизвестная'}`
            : 'Остановлен';

  const currentModelName = serverStatus?.model ?? null;
  const isActive = status === 'running' || status === 'starting' || status === 'stopping';

  // If engine not found — show setup instructions
  if (engineInfo && !engineInfo.found) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2.5 text-sm text-[var(--color-text-muted)] bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
          <Download size={16} className="flex-shrink-0 mt-0.5 text-amber-400" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[var(--color-text)] font-medium text-xs">llama-server не найден</span>
            <span className="text-xs leading-relaxed">
              Скачайте <span className="font-mono text-[var(--color-primary)]">llama-server</span> с GitHub Releases и
              поместите в папку <span className="font-mono bg-[var(--color-surface-2)] px-1 py-0.5 rounded">bin/</span>{' '}
              проекта.
            </span>
            <span className="text-[10px] opacity-60">Выберите сборку: CUDA (NVIDIA), Vulkan (AMD/Intel) или CPU</span>
          </div>
        </div>
        <a
          href="https://github.com/ggml-org/llama.cpp/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:underline w-fit"
        >
          <ExternalLink size={12} />
          github.com/ggml-org/llama.cpp/releases
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status bar */}
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot}`} />
        <span className="text-sm text-[var(--color-text-muted)] flex-1">{statusText}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            title="Настройки"
          >
            <Settings size={14} />
          </button>
          {isActive && (
            <Button variant="ghost" size="sm" onClick={handleStop} disabled={status === 'stopping'}>
              <Square size={13} />
              Стоп
            </Button>
          )}
        </div>
      </div>

      {/* Current model */}
      {currentModelName && status === 'running' && (
        <div className="text-xs text-[var(--color-text-muted)]">
          Модель:{' '}
          <span className="font-mono bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded text-[var(--color-text)]">
            {currentModelName}
          </span>
        </div>
      )}

      {/* Loading progress bar */}
      {status === 'starting' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <Loader2 size={12} className="animate-spin" />
            <span>Загрузка {currentModelName}...</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Error display */}
      {status === 'error' && serverStatus?.error && (
        <div className="flex items-start gap-2 text-xs text-[var(--color-danger)] bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>{serverStatus.error}</span>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="border border-[var(--color-border)] rounded-lg p-3 flex flex-col gap-3 bg-[var(--color-surface-2)]/50">
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Папка с моделями</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={llmServerConfig.modelsDir || engineInfo?.defaultModelsDir || ''}
                onChange={(e) => setLlmServerConfig({ modelsDir: e.target.value })}
                placeholder={engineInfo?.defaultModelsDir ?? 'models'}
                className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono"
              />
              <button
                onClick={async () => {
                  setBrowsing(true);
                  try {
                    const path = await browseFolder(effectiveModelsDir || undefined);
                    if (path) setLlmServerConfig({ modelsDir: path });
                  } finally {
                    setBrowsing(false);
                  }
                }}
                disabled={browsing}
                className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer disabled:opacity-50"
                title="Выбрать папку"
              >
                {browsing ? <Loader2 size={13} className="animate-spin" /> : <FolderOpen size={13} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">GPU Layers</label>
              <input
                type="number"
                value={llmServerConfig.gpuLayers}
                onChange={(e) => setLlmServerConfig({ gpuLayers: Number(e.target.value) })}
                min={0}
                max={999}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
              <span className="text-[10px] text-[var(--color-text-muted)] opacity-60">0 = CPU, 999 = все на GPU</span>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Context Size</label>
              <input
                type="number"
                value={llmServerConfig.contextSize}
                onChange={(e) => setLlmServerConfig({ contextSize: Number(e.target.value) })}
                min={512}
                max={262144}
                step={512}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Threads</label>
              <input
                type="number"
                value={llmServerConfig.threads}
                onChange={(e) => setLlmServerConfig({ threads: Number(e.target.value) })}
                min={0}
                max={128}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
              <span className="text-[10px] text-[var(--color-text-muted)] opacity-60">0 = авто</span>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Порт</label>
              <input
                type="number"
                value={llmServerConfig.port}
                onChange={(e) => setLlmServerConfig({ port: Number(e.target.value) })}
                min={1024}
                max={65535}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={llmServerConfig.flashAttention}
              onChange={(e) => setLlmServerConfig({ flashAttention: e.target.checked })}
              className="accent-[var(--color-primary)]"
            />
            Flash Attention
          </label>
        </div>
      )}

      {/* Models list */}
      {modelFiles && modelFiles.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-[var(--color-text-muted)] font-medium mb-1">Доступные модели</div>
          {modelFiles.map((model) => {
            const isCurrent = currentModelName && status === 'running' && model.name === currentModelName;
            const isLoading = status === 'starting' && currentModelName && model.name === currentModelName;

            return (
              <div
                key={model.path}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
                  isCurrent
                    ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <HardDrive size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-text)] truncate" title={model.name}>
                    {model.name}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)] opacity-60">{formatSize(model.size)}</div>
                </div>
                {isCurrent ? (
                  <span className="text-[10px] text-[var(--color-accent)] font-medium px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10">
                    Текущая
                  </span>
                ) : isLoading ? (
                  <Loader2 size={14} className="text-amber-400 animate-spin" />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStartModel(model)}
                    disabled={isActive}
                    className="text-[10px] !px-2 !py-1"
                  >
                    <Play size={11} />
                    Запуск
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No models found */}
      {modelFiles && modelFiles.length === 0 && effectiveModelsDir && (
        <div className="text-xs text-[var(--color-text-muted)] text-center py-3">
          Модели (.gguf) не найдены в {effectiveModelsDir}
        </div>
      )}
    </div>
  );
}
