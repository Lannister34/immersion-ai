import { clsx } from 'clsx';
import { FileText, RotateCcw as Reset, Sliders, X } from 'lucide-react';
import type { JSX } from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getBasePreset, getEffectiveSamplerSettings, useAppStore } from '@/stores';
import type { Character, ChatSessionMeta, SamplerSettings, Scenario } from '@/types';
import { ChatSettingSlider } from './ChatSettingSlider';
import { ContextTrimToggle } from './ContextTrimToggle';
import { ModelSettingsSection } from './ModelSettingsSection';
import { SystemPromptSection } from './SystemPromptSection';

// ── Scenario Display (stateless, <15 lines) ─────────────────────────────────

function ScenarioDisplay({ session }: { session: ChatSessionMeta | null }): JSX.Element | null {
  const { t } = useTranslation();
  const activeScenarioName = session?.activeScenarioName;
  if (!activeScenarioName) return null;

  return (
    <div className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-3">
      <div className="flex items-center gap-1.5">
        <FileText size={10} className="text-[var(--color-primary)]" />
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          {t('chatSettings.scenarioLabel')}
        </span>
      </div>
      <div className="text-xs text-[var(--color-text)]">{activeScenarioName}</div>
      <div className="text-[9px] text-[var(--color-text-muted)] opacity-60">{t('chatSettings.scenarioHint')}</div>
    </div>
  );
}

// ── Chat Settings Panel (main export) ───────────────────────────────────────

interface ChatSettingsPanelProps {
  session: ChatSessionMeta | null;
  chatFile: string | null;
  character: Character | null;
  activeScenario: Scenario | null;
  onClose: () => void;
  onSettingsChanged?: () => void;
}

export function ChatSettingsPanel({
  session,
  chatFile,
  character,
  activeScenario,
  onClose,
  onSettingsChanged,
}: ChatSettingsPanelProps): JSX.Element {
  const { t } = useTranslation();
  const upsertChatSession = useAppStore((s) => s.upsertChatSession);
  const state = useAppStore.getState();

  // Base preset (model or global) and effective settings (base + chat overrides)
  const basePreset = getBasePreset(state);
  const effective = getEffectiveSamplerSettings(state, chatFile ?? undefined);

  const customOverrides = session?.customSamplerSettings ?? {};
  const hasOverrides = Object.keys(customOverrides).length > 0;

  const updateSession = useCallback(
    (patch: Partial<ChatSessionMeta>) => {
      if (!session) return;
      upsertChatSession({ ...session, ...patch });
      onSettingsChanged?.();
    },
    [session, upsertChatSession, onSettingsChanged],
  );

  const handleOverride = useCallback(
    (key: keyof SamplerSettings, value: SamplerSettings[keyof SamplerSettings]) => {
      updateSession({
        customSamplerSettings: { ...customOverrides, [key]: value },
      });
    },
    [updateSession, customOverrides],
  );

  const handleResetOverrides = useCallback(() => {
    updateSession({ customSamplerSettings: {} });
  }, [updateSession]);

  return (
    <div className="w-full sm:w-72 fixed inset-0 sm:relative sm:inset-auto z-30 sm:z-auto flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1.5">
          <Sliders size={13} className="text-[var(--color-primary)]" />
          <span className="text-xs font-semibold text-[var(--color-text)]">{t('chatSettings.title')}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                {t('chatSettings.presetLabel')}
              </label>
              <span
                className={clsx(
                  'text-xs font-medium',
                  hasOverrides ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]',
                )}
              >
                {hasOverrides ? 'Custom' : basePreset.name}
              </span>
            </div>
            {hasOverrides && (
              <span className="text-[9px] text-[var(--color-text-muted)] opacity-60">({basePreset.name})</span>
            )}
          </div>
          {hasOverrides && (
            <button
              onClick={handleResetOverrides}
              className="text-[10px] px-2 py-1 rounded-md bg-[var(--color-surface-2)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15 cursor-pointer flex items-center gap-1 transition-colors"
            >
              <Reset size={10} />
              {t('common.reset')}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {!hasOverrides && (
            <div className="text-[9px] text-[var(--color-text-muted)] opacity-60 mb-1">
              {t('chatSettings.overrideHint')}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <ChatSettingSlider
              label="Temperature"
              tooltip={t('samplers.temperatureTooltip')}
              value={customOverrides.temperature ?? effective.temperature}
              onChange={(v) => handleOverride('temperature', v)}
              modified={'temperature' in customOverrides}
              min={0.1}
              max={2.0}
              step={0.05}
            />
            <ChatSettingSlider
              label="Min P"
              tooltip={t('samplers.minPTooltip')}
              value={customOverrides.min_p ?? effective.min_p}
              onChange={(v) => handleOverride('min_p', v)}
              modified={'min_p' in customOverrides}
              min={0}
              max={0.5}
              step={0.01}
            />
            <ChatSettingSlider
              label="Top P"
              tooltip={t('samplers.topPTooltip')}
              value={customOverrides.top_p ?? effective.top_p}
              onChange={(v) => handleOverride('top_p', v)}
              modified={'top_p' in customOverrides}
              min={0}
              max={1}
              step={0.05}
            />
            <ChatSettingSlider
              label="Top K"
              tooltip={t('samplers.topKTooltip')}
              value={customOverrides.top_k ?? effective.top_k}
              onChange={(v) => handleOverride('top_k', v)}
              modified={'top_k' in customOverrides}
              min={0}
              max={200}
              step={1}
            />
            <ChatSettingSlider
              label="Rep. Penalty"
              tooltip={t('samplers.repPenTooltip')}
              value={customOverrides.rep_pen ?? effective.rep_pen}
              onChange={(v) => handleOverride('rep_pen', v)}
              modified={'rep_pen' in customOverrides}
              min={1}
              max={1.5}
              step={0.01}
            />
            <ChatSettingSlider
              label="Rep. Pen. Range"
              tooltip={t('samplers.repPenRangeTooltip')}
              value={customOverrides.rep_pen_range ?? effective.rep_pen_range}
              onChange={(v) => handleOverride('rep_pen_range', v)}
              modified={'rep_pen_range' in customOverrides}
              min={0}
              max={8192}
              step={128}
            />
            <ChatSettingSlider
              label="Presence Penalty"
              tooltip={t('samplers.presencePenaltyTooltip')}
              value={customOverrides.presence_penalty ?? effective.presence_penalty}
              onChange={(v) => handleOverride('presence_penalty', v)}
              modified={'presence_penalty' in customOverrides}
              min={0}
              max={2}
              step={0.05}
            />
            <ChatSettingSlider
              label="Max Tokens"
              tooltip={t('samplers.maxTokensTooltip')}
              value={customOverrides.max_length ?? effective.max_length}
              onChange={(v) => handleOverride('max_length', v)}
              modified={'max_length' in customOverrides}
              min={64}
              max={32768}
              step={64}
            />
            <ContextTrimToggle
              value={customOverrides.context_trim_strategy ?? effective.context_trim_strategy}
              onChange={(v) => handleOverride('context_trim_strategy', v)}
              modified={'context_trim_strategy' in customOverrides}
            />
          </div>
        </div>

        <ModelSettingsSection
          effectiveContextSize={effective.max_context_length}
          onContextSizeOverride={(value) => handleOverride('max_context_length', value)}
        />

        <ScenarioDisplay session={session} />

        <SystemPromptSection
          session={session}
          character={character}
          activeScenario={activeScenario}
          onSettingsChanged={onSettingsChanged}
        />
      </div>
    </div>
  );
}
