import { Check, Cpu, Loader2, RotateCcw as Reset } from 'lucide-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '@/api';
import { useAppStore } from '@/stores';

interface ModelSettingsSectionProps {
  effectiveContextSize: number;
  onContextSizeOverride?: (value: number) => void;
}

export function ModelSettingsSection({
  effectiveContextSize,
  onContextSizeOverride,
}: ModelSettingsSectionProps): JSX.Element {
  const { t } = useTranslation();
  const { llmServerConfig, setLlmServerConfig, backendMode, connection } = useAppStore();
  const [localContextSize, setLocalContextSize] = useState(effectiveContextSize);
  const [restarting, setRestarting] = useState(false);

  // Sync local state when effective context changes (e.g., preset switch)
  useEffect(() => {
    setLocalContextSize(effectiveContextSize);
  }, [effectiveContextSize]);

  const hasChanged = localContextSize !== effectiveContextSize;
  const isBuiltinRunning = backendMode === 'builtin' && connection.connected;

  const handleContextSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalContextSize(Number(e.target.value));
  }, []);

  const handleReset = useCallback(() => {
    setLocalContextSize(effectiveContextSize);
  }, [effectiveContextSize]);

  const handleApply = useCallback(async () => {
    if (!hasChanged) return;

    // Persist to per-model settings for currently loaded model
    const currentModel = useAppStore.getState().connection.model;
    if (currentModel) {
      useAppStore.getState().setModelSettings(currentModel, { contextSize: localContextSize });
    }

    // Create per-chat sampler override so generation uses the new context size
    onContextSizeOverride?.(localContextSize);

    const needsRestart = localContextSize !== llmServerConfig.contextSize;

    if (needsRestart && isBuiltinRunning) {
      // Restart server with new context size
      setRestarting(true);
      try {
        const status = await api.getLlmServerStatus();
        const modelPath = status.modelPath;

        if (!modelPath) {
          setLlmServerConfig({ contextSize: localContextSize });
          setRestarting(false);
          return;
        }

        setLlmServerConfig({ contextSize: localContextSize });

        // Stop server
        await api.stopLlmServer();

        // Poll until idle
        let attempts = 0;
        while (attempts < 60) {
          await new Promise((r) => setTimeout(r, 500));
          const s = await api.getLlmServerStatus();
          if (s.status === 'idle' || s.status === 'error') break;
          attempts++;
        }

        // Restart with new config
        const cfg = useAppStore.getState().llmServerConfig;
        await api.startLlmServer({
          modelPath,
          port: cfg.port,
          gpuLayers: cfg.gpuLayers,
          contextSize: cfg.contextSize,
          flashAttention: cfg.flashAttention,
          threads: cfg.threads,
        });
      } catch (err) {
        console.error('[ModelSettings] restart failed:', err);
      } finally {
        setRestarting(false);
      }
    } else if (needsRestart) {
      setLlmServerConfig({ contextSize: localContextSize });
    }
  }, [
    hasChanged,
    isBuiltinRunning,
    localContextSize,
    llmServerConfig.contextSize,
    setLlmServerConfig,
    onContextSizeOverride,
  ]);

  return (
    <div className="flex flex-col gap-2.5 border-t border-[var(--color-border)] pt-3">
      <div className="flex items-center gap-1.5">
        <Cpu size={10} className="text-[var(--color-primary)]" />
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          {t('chatSettings.modelSettingsTitle')}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-[var(--color-text-muted)]">Context Size</label>
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
            {localContextSize.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min={2048}
          max={131072}
          step={1024}
          value={localContextSize}
          onChange={handleContextSizeChange}
          className="w-full accent-[var(--color-primary)]"
          disabled={restarting}
        />
        <div className="flex items-center justify-between text-[9px] text-[var(--color-text-muted)] opacity-50">
          <span>2K</span>
          <span>128K</span>
        </div>
      </div>

      {hasChanged && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleApply}
            disabled={restarting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {restarting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {t('chatSettings.restartingServer')}
              </>
            ) : (
              <>
                <Check size={12} />
                {isBuiltinRunning && localContextSize !== llmServerConfig.contextSize
                  ? t('chatSettings.applyRestart')
                  : t('common.apply')}
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            disabled={restarting}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
            title={t('common.reset')}
          >
            <Reset size={14} />
          </button>
        </div>
      )}

      {!hasChanged && isBuiltinRunning && (
        <div className="text-[9px] text-[var(--color-text-muted)] opacity-50">
          {t('chatSettings.contextChangeWillRestart')}
        </div>
      )}
    </div>
  );
}
