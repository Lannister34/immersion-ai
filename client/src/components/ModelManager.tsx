import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronDown,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Square,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EngineInfo, LlmServerStatus, ModelFile } from '@/api';
import { browseFolder, getEngineInfo, getLlmServerStatus, listModelFiles, startLlmServer, stopLlmServer } from '@/api';
import { Button } from '@/components/ui/Button';
import { resolveContextSize, useAppStore } from '@/stores';

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface ModelCardProps {
  model: ModelFile;
  isCurrent: boolean;
  isLoading: boolean;
  isActive: boolean;
  isExpanded: boolean;
  modelSettings: Record<string, import('@/types').ModelSettings>;
  modelPresetMap: Record<string, string>;
  samplerPresets: import('@/types').SamplerPreset[];
  onToggleExpand: () => void;
  onStart: (model: ModelFile) => void;
  onContextChange: (size: number) => void;
  onContextReset: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

// ── Model Card ──────────────────────────────────────────────────────────────

function ModelCard({
  model,
  isCurrent,
  isLoading,
  isActive,
  isExpanded,
  modelSettings,
  modelPresetMap,
  samplerPresets,
  onToggleExpand,
  onStart,
  onContextChange,
  onContextReset,
  t,
}: ModelCardProps) {
  const hasOverride = modelSettings[model.name]?.contextSize != null;
  const presetId = modelPresetMap[model.name];
  const boundPreset = presetId ? samplerPresets.find((p) => p.id === presetId) : undefined;

  let resolvedContext = 8192;
  if (hasOverride) {
    resolvedContext = modelSettings[model.name].contextSize!;
  } else if (boundPreset) {
    resolvedContext = boundPreset.max_context_length;
  }

  const getContextSourceLabel = (): string => {
    if (hasOverride) return t('modelManager.contextSizeCustom');
    if (boundPreset) return t('modelManager.contextSizeFromPreset', { preset: boundPreset.name });
    return t('modelManager.contextSizeDefault');
  };

  const handleContextInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      if (val >= 512 && val <= 262144) {
        onContextChange(val);
      }
    },
    [onContextChange],
  );

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isCurrent
          ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5'
          : 'border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer flex-shrink-0"
        >
          <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
        </button>
        <HardDrive size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[var(--color-text)] truncate" title={model.name}>
            {model.name}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] opacity-60">{formatSize(model.size)}</div>
        </div>
        {isCurrent && (
          <span className="text-[10px] text-[var(--color-accent)] font-medium px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10">
            {t('modelManager.currentBadge')}
          </span>
        )}
        {isLoading && <Loader2 size={14} className="text-amber-400 animate-spin" />}
        {!isCurrent && !isLoading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStart(model)}
            disabled={isActive}
            className="text-[10px] !px-2 !py-1"
          >
            <Play size={11} />
            {t('modelManager.startButton')}
          </Button>
        )}
      </div>

      {/* Expandable settings */}
      {isExpanded && (
        <div className="px-3 pb-2.5 pt-0.5 border-t border-[var(--color-border)]/50">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-[var(--color-text-muted)] font-medium">
              {t('modelManager.contextSizeLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={resolvedContext}
                onChange={handleContextInput}
                min={512}
                max={262144}
                step={512}
                className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] min-w-0"
              />
              {hasOverride && (
                <button
                  type="button"
                  onClick={onContextReset}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                  title={t('modelManager.contextSizeReset')}
                >
                  <RotateCcw size={11} />
                  {t('modelManager.contextSizeReset')}
                </button>
              )}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] opacity-60">{getContextSourceLabel()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Model Manager ───────────────────────────────────────────────────────────

export function ModelManager() {
  const { t } = useTranslation();
  const {
    llmServerConfig,
    setLlmServerConfig,
    setConnection,
    modelSettings,
    setModelSettings,
    clearModelSettings,
    modelPresetMap,
    samplerPresets,
  } = useAppStore();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [browsing, setBrowsing] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const prevStatusRef = useRef<string>('idle');

  // Check engine availability
  const { data: engineInfo } = useQuery<EngineInfo>({
    queryKey: ['engine-info'],
    queryFn: getEngineInfo,
    staleTime: 60_000,
  });

  // Set default modelsDirs from engine info on first load
  useEffect(() => {
    if (engineInfo?.defaultModelsDir && llmServerConfig.modelsDirs.length === 0) {
      setLlmServerConfig({ modelsDirs: [engineInfo.defaultModelsDir] });
    }
  }, [engineInfo?.defaultModelsDir, llmServerConfig.modelsDirs.length, setLlmServerConfig]);

  // Poll server status every 2s
  const { data: serverStatus } = useQuery<LlmServerStatus>({
    queryKey: ['llm-server-status'],
    queryFn: getLlmServerStatus,
    refetchInterval: 2000,
  });

  const status = serverStatus?.status ?? 'idle';

  // Effective model directories (from config or engine default)
  let effectiveModelsDirs: string[] = [];
  if (llmServerConfig.modelsDirs.length > 0) {
    effectiveModelsDirs = llmServerConfig.modelsDirs;
  } else if (engineInfo?.defaultModelsDir) {
    effectiveModelsDirs = [engineInfo.defaultModelsDir];
  }

  // List model files from all directories
  const { data: modelFiles } = useQuery<ModelFile[]>({
    queryKey: ['model-files', effectiveModelsDirs],
    queryFn: () => listModelFiles(effectiveModelsDirs),
    enabled: effectiveModelsDirs.length > 0,
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

  const handleStartModel = useCallback(
    async (model: ModelFile) => {
      try {
        const state = useAppStore.getState();
        const contextSize = resolveContextSize(state, model.name);

        // Update llmServerConfig so all components see the correct value immediately
        setLlmServerConfig({ contextSize });

        await startLlmServer({
          modelPath: model.path,
          port: llmServerConfig.port,
          gpuLayers: llmServerConfig.gpuLayers,
          contextSize,
          flashAttention: llmServerConfig.flashAttention,
          threads: llmServerConfig.threads,
        });
        // Immediately refetch status after starting
        void queryClient.invalidateQueries({ queryKey: ['llm-server-status'] });
      } catch (err) {
        console.error('Failed to start LLM server:', err);
      }
    },
    [llmServerConfig, setLlmServerConfig, queryClient],
  );

  const handleStop = async () => {
    try {
      await stopLlmServer();
      // Immediately refetch status after stopping
      void queryClient.invalidateQueries({ queryKey: ['llm-server-status'] });
    } catch (err) {
      console.error('Failed to stop LLM server:', err);
    }
  };

  const getStatusDot = (): string => {
    if (status === 'running') return 'bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]';
    if (status === 'starting' || status === 'stopping')
      return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)] animate-pulse';
    if (status === 'error') return 'bg-[var(--color-danger)] shadow-[0_0_8px_var(--color-danger)]';
    return 'bg-[var(--color-text-muted)]';
  };
  const statusDot = getStatusDot();

  const getStatusText = (): string => {
    if (status === 'running') {
      return serverStatus?.pid
        ? t('modelManager.statusRunningPid', { pid: serverStatus.pid })
        : t('modelManager.statusRunning');
    }
    if (status === 'starting') {
      return t('modelManager.statusStarting', { elapsed: formatElapsed(elapsed) });
    }
    if (status === 'stopping') return t('modelManager.statusStopping');
    if (status === 'error') {
      return t('modelManager.statusError', { error: serverStatus?.error ?? t('modelManager.unknownError') });
    }
    return t('modelManager.statusIdle');
  };

  const currentModelName = serverStatus?.model ?? null;
  const isActive = status === 'running' || status === 'starting' || status === 'stopping';

  // If engine not found — show setup instructions
  if (engineInfo && !engineInfo.found) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2.5 text-sm text-[var(--color-text-muted)] bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
          <Download size={16} className="flex-shrink-0 mt-0.5 text-amber-400" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[var(--color-text)] font-medium text-xs">{t('modelManager.engineNotFound')}</span>
            <span className="text-xs leading-relaxed">{t('modelManager.engineDownloadHint')}</span>
            <span className="text-[10px] opacity-60">{t('modelManager.engineBuildHint')}</span>
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
        <span className="text-sm text-[var(--color-text-muted)] flex-1">{getStatusText()}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            title={t('modelManager.settingsTooltip')}
          >
            <Settings size={14} />
          </button>
          {isActive && (
            <Button variant="ghost" size="sm" onClick={handleStop} disabled={status === 'stopping'}>
              <Square size={13} />
              {t('modelManager.stop')}
            </Button>
          )}
        </div>
      </div>

      {/* Current model */}
      {currentModelName && status === 'running' && (
        <div className="text-xs text-[var(--color-text-muted)]">
          {t('modelManager.modelLabel')}
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
            <span>{t('modelManager.loadingModel', { modelName: currentModelName })}</span>
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
            <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">
              {t('modelManager.modelsDirsLabel')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {effectiveModelsDirs.map((dir) => (
                <span
                  key={dir}
                  className="inline-flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2.5 py-1 text-xs text-[var(--color-text)] font-mono max-w-full"
                >
                  <span className="truncate">{dir}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = llmServerConfig.modelsDirs.filter((d) => d !== dir);
                      setLlmServerConfig({ modelsDirs: updated });
                    }}
                    className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <button
                onClick={async () => {
                  setBrowsing(true);
                  try {
                    const selected = await browseFolder(effectiveModelsDirs[0] || undefined);
                    if (selected && !llmServerConfig.modelsDirs.includes(selected)) {
                      setLlmServerConfig({ modelsDirs: [...llmServerConfig.modelsDirs, selected] });
                    }
                  } finally {
                    setBrowsing(false);
                  }
                }}
                disabled={browsing}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-md text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {browsing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {t('modelManager.addFolderButton')}
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
              <span className="text-[10px] text-[var(--color-text-muted)] opacity-60">
                {t('modelManager.gpuLayersHint')}
              </span>
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
              <span className="text-[10px] text-[var(--color-text-muted)] opacity-60">
                {t('modelManager.threadsHint')}
              </span>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] mb-1 block">{t('modelManager.portLabel')}</label>
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
          <div className="text-xs text-[var(--color-text-muted)] font-medium mb-1">
            {t('modelManager.availableModels')}
          </div>
          {modelFiles.map((model) => {
            const isCurrent = currentModelName && status === 'running' && model.name === currentModelName;
            const isLoading = status === 'starting' && currentModelName && model.name === currentModelName;
            const isExpanded = expandedModel === model.name;

            return (
              <ModelCard
                key={model.path}
                model={model}
                isCurrent={!!isCurrent}
                isLoading={!!isLoading}
                isActive={isActive}
                isExpanded={isExpanded}
                modelSettings={modelSettings}
                modelPresetMap={modelPresetMap}
                samplerPresets={samplerPresets}
                onToggleExpand={() => setExpandedModel(isExpanded ? null : model.name)}
                onStart={handleStartModel}
                onContextChange={(size) => setModelSettings(model.name, { contextSize: size })}
                onContextReset={() => clearModelSettings(model.name)}
                t={t}
              />
            );
          })}
        </div>
      )}

      {/* No models found */}
      {modelFiles && modelFiles.length === 0 && effectiveModelsDirs.length > 0 && (
        <div className="text-xs text-[var(--color-text-muted)] text-center py-3">
          {t('modelManager.noModelsFound', { dir: effectiveModelsDirs.join(', ') })}
        </div>
      )}
    </div>
  );
}
