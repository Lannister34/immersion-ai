import { clsx } from 'clsx';
import { Check, ChevronRight, Cpu, FileText, Loader2, RotateCcw as Reset, Sliders, X } from 'lucide-react';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';

import * as api from '@/api';
import { computeBaseSystemPrompt } from '@/lib/promptBuilder';
import { getBasePreset, getEffectiveSamplerSettings, useAppStore } from '@/stores';
import type { Character, ChatSessionMeta, ContextTrimStrategy, SamplerSettings, Scenario } from '@/types';

// ── Chat Setting Slider ─────────────────────────────────────────────────────

function ChatSettingSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  modified,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  hint?: string;
  modified?: boolean;
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-center">
        <div className="relative flex items-center gap-1">
          <label
            className={clsx(
              'text-[10px] cursor-help',
              modified ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]',
            )}
            onMouseEnter={() => tooltip && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {label}
          </label>
          {showTooltip && tooltip && (
            <div className="absolute left-0 bottom-full mb-1 z-50 w-[min(13rem,calc(100vw-2rem))] px-2.5 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-lg text-[10px] leading-snug text-[var(--color-text-muted)] pointer-events-none">
              {tooltip}
            </div>
          )}
        </div>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="w-16 text-right bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-1 bg-[var(--color-surface-2)] rounded-full appearance-none cursor-pointer accent-[var(--color-primary)]"
      />
      {hint && <span className="text-[9px] text-[var(--color-text-muted)] opacity-50">{hint}</span>}
    </div>
  );
}

// ── Context Trim Toggle ─────────────────────────────────────────────────────

function ContextTrimToggle({
  value,
  onChange,
  modified,
}: {
  value: ContextTrimStrategy;
  onChange: (v: ContextTrimStrategy) => void;
  modified?: boolean;
}) {
  const options: { key: ContextTrimStrategy; label: string }[] = [
    { key: 'trim_start', label: 'Начало' },
    { key: 'trim_middle', label: 'Середина' },
  ];
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center gap-1">
        <label
          className={clsx(
            'text-[10px] cursor-help',
            modified ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]',
          )}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          Обрезка контекста
        </label>
        {showTooltip && (
          <div className="absolute left-0 bottom-full mb-1 z-50 w-[min(13rem,calc(100vw-2rem))] px-2.5 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-lg text-[10px] leading-snug text-[var(--color-text-muted)] pointer-events-none">
            Что удалять при заполнении контекста. «Начало» — самые старые сообщения удаляются первыми. «Середина» —
            сохраняет начало чата (завязка, приветствие) и последние сообщения, удаляя середину.
          </div>
        )}
      </div>
      <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={clsx(
              'flex-1 px-2 py-1 text-[10px] font-medium transition-colors cursor-pointer',
              value === opt.key
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Model Settings Section ──────────────────────────────────────────────────

function ModelSettingsSection(): JSX.Element {
  const { llmServerConfig, setLlmServerConfig, backendMode, connection } = useAppStore();
  const [localContextSize, setLocalContextSize] = useState(llmServerConfig.contextSize);
  const [restarting, setRestarting] = useState(false);

  // Sync local state when store changes externally
  useEffect(() => {
    setLocalContextSize(llmServerConfig.contextSize);
  }, [llmServerConfig.contextSize]);

  const hasChanged = localContextSize !== llmServerConfig.contextSize;
  const isBuiltinRunning = backendMode === 'builtin' && connection.connected;

  const handleApply = async () => {
    if (!hasChanged) return;

    if (isBuiltinRunning) {
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
    } else {
      setLlmServerConfig({ contextSize: localContextSize });
    }
  };

  return (
    <div className="flex flex-col gap-2.5 border-t border-[var(--color-border)] pt-3">
      <div className="flex items-center gap-1.5">
        <Cpu size={10} className="text-[var(--color-primary)]" />
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          Настройки модели
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
          onChange={(e) => setLocalContextSize(Number(e.target.value))}
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
                Перезапуск сервера...
              </>
            ) : (
              <>
                <Check size={12} />
                Применить{isBuiltinRunning ? ' (перезапуск)' : ''}
              </>
            )}
          </button>
          <button
            onClick={() => setLocalContextSize(llmServerConfig.contextSize)}
            disabled={restarting}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
            title="Сбросить"
          >
            <Reset size={14} />
          </button>
        </div>
      )}

      {!hasChanged && isBuiltinRunning && (
        <div className="text-[9px] text-[var(--color-text-muted)] opacity-50">
          Изменение контекста перезапустит сервер
        </div>
      )}
    </div>
  );
}

// ── Scenario Display ────────────────────────────────────────────────────────

function ScenarioDisplay({ session }: { session: ChatSessionMeta | null }): JSX.Element | null {
  const activeScenarioName = session?.activeScenarioName;
  if (!activeScenarioName) return null;

  return (
    <div className="flex flex-col gap-1 border-t border-[var(--color-border)] pt-3">
      <div className="flex items-center gap-1.5">
        <FileText size={10} className="text-[var(--color-primary)]" />
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Сценарий</span>
      </div>
      <div className="text-xs text-[var(--color-text)]">{activeScenarioName}</div>
      <div className="text-[9px] text-[var(--color-text-muted)] opacity-60">Выбирается при создании чата</div>
    </div>
  );
}

// ── System Prompt Section ───────────────────────────────────────────────────

function SystemPromptSection({
  session,
  character,
  activeScenario,
  onSettingsChanged,
}: {
  session: ChatSessionMeta | null;
  character: Character | null;
  activeScenario: Scenario | null;
  onSettingsChanged?: () => void;
}): JSX.Element | null {
  const [expanded, setExpanded] = useState(false);
  const upsertChatSession = useAppStore((s) => s.upsertChatSession);

  const autoPrompt = useMemo(() => {
    if (!character) return '';
    return computeBaseSystemPrompt(character, session?.characterOverrides, activeScenario);
  }, [character, session?.characterOverrides, activeScenario]);

  const hasOverride = !!session?.customSystemPrompt;
  const displayText = hasOverride ? session!.customSystemPrompt! : autoPrompt;

  const [editText, setEditText] = useState(displayText);

  useEffect(() => {
    setEditText(displayText);
  }, [displayText]);

  const isDirty = editText !== displayText;

  const handleSave = () => {
    if (!session) return;
    upsertChatSession({ ...session, customSystemPrompt: editText });
    onSettingsChanged?.();
  };

  const handleReset = () => {
    if (!session) return;
    upsertChatSession({ ...session, customSystemPrompt: null });
    setEditText(autoPrompt);
    onSettingsChanged?.();
  };

  if (!character) return null;

  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-3">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 cursor-pointer group">
        <ChevronRight
          size={12}
          className={clsx('text-[var(--color-primary)] transition-transform duration-200', expanded && 'rotate-90')}
        />
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide group-hover:text-[var(--color-text)] transition-colors">
          Системный промпт
        </span>
        {hasOverride && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
            Custom
          </span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 mt-1">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={12}
            className="w-full text-[11px] leading-relaxed bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2.5 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors resize-y font-mono"
          />
          <div className="text-[9px] text-[var(--color-text-muted)] opacity-60">
            World Info и язык добавляются автоматически
          </div>
          <div className="flex items-center gap-1.5">
            {isDirty && (
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 transition-colors cursor-pointer"
              >
                <Check size={10} />
                Сохранить
              </button>
            )}
            {hasOverride && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-[var(--color-surface-2)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15 transition-colors cursor-pointer"
              >
                <Reset size={10} />
                Сбросить
              </button>
            )}
          </div>
        </div>
      )}
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
  const upsertChatSession = useAppStore((s) => s.upsertChatSession);
  const state = useAppStore.getState();

  // Base preset (model or global) and effective settings (base + chat overrides)
  const basePreset = getBasePreset(state);
  const effective = getEffectiveSamplerSettings(state, chatFile ?? undefined);

  const customOverrides = session?.customSamplerSettings ?? {};
  const hasOverrides = Object.keys(customOverrides).length > 0;

  const updateSession = (patch: Partial<ChatSessionMeta>) => {
    if (!session) return;
    upsertChatSession({ ...session, ...patch });
    onSettingsChanged?.();
  };

  const handleOverride = (key: keyof SamplerSettings, value: SamplerSettings[keyof SamplerSettings]) => {
    updateSession({
      customSamplerSettings: { ...customOverrides, [key]: value },
    });
  };

  const handleResetOverrides = () => {
    updateSession({ customSamplerSettings: {} });
  };

  return (
    <div className="w-full sm:w-72 fixed inset-0 sm:relative sm:inset-auto z-30 sm:z-auto flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1.5">
          <Sliders size={13} className="text-[var(--color-primary)]" />
          <span className="text-xs font-semibold text-[var(--color-text)]">Настройки чата</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-3">
        {/* Active preset info + Custom badge + Reset */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Пресет
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
              Сбросить
            </button>
          )}
        </div>

        {/* Per-chat overrides */}
        <div className="flex flex-col gap-1.5">
          {!hasOverrides && (
            <div className="text-[9px] text-[var(--color-text-muted)] opacity-60 mb-1">
              Измените значение, чтобы создать переопределение для этого чата
            </div>
          )}

          <div className="flex flex-col gap-3">
            <ChatSettingSlider
              label="Temperature"
              tooltip="Креативность ответов. Низкие значения (0.1–0.5) — предсказуемый текст, высокие (0.8–1.5) — разнообразный и неожиданный. Слишком высокие значения могут давать бессвязный текст."
              value={customOverrides.temperature ?? effective.temperature}
              onChange={(v) => handleOverride('temperature', v)}
              modified={'temperature' in customOverrides}
              min={0.1}
              max={2.0}
              step={0.05}
            />
            <ChatSettingSlider
              label="Min P"
              tooltip="Отсекает токены, вероятность которых ниже заданной доли от самого вероятного. Например, 0.05 = убрать всё, что менее 5% от лучшего варианта. Хорошо убирает мусор, сохраняя разнообразие."
              value={customOverrides.min_p ?? effective.min_p}
              onChange={(v) => handleOverride('min_p', v)}
              modified={'min_p' in customOverrides}
              min={0}
              max={0.5}
              step={0.01}
            />
            <ChatSettingSlider
              label="Top P"
              tooltip="Nucleus sampling — выбирает из наименьшего набора токенов, чья суммарная вероятность ≥ значения. 1.0 = все токены, 0.9 = верхние 90% вероятности. Чем ниже, тем консервативнее."
              value={customOverrides.top_p ?? effective.top_p}
              onChange={(v) => handleOverride('top_p', v)}
              modified={'top_p' in customOverrides}
              min={0}
              max={1}
              step={0.05}
            />
            <ChatSettingSlider
              label="Top K"
              tooltip="Ограничивает выбор только K самыми вероятными токенами. 0 = без ограничения, 40 = только топ-40 вариантов. Грубый фильтр, лучше использовать Min P."
              value={customOverrides.top_k ?? effective.top_k}
              onChange={(v) => handleOverride('top_k', v)}
              modified={'top_k' in customOverrides}
              min={0}
              max={200}
              step={1}
            />
            <ChatSettingSlider
              label="Rep. Penalty"
              tooltip="Штраф за повторение токенов. 1.0 = выключено, 1.05–1.10 = мягкий штраф, >1.15 = агрессивный (может ломать текст). Помогает избежать зацикливания на одних и тех же фразах."
              value={customOverrides.rep_pen ?? effective.rep_pen}
              onChange={(v) => handleOverride('rep_pen', v)}
              modified={'rep_pen' in customOverrides}
              min={1}
              max={1.5}
              step={0.01}
            />
            <ChatSettingSlider
              label="Rep. Pen. Range"
              tooltip="Сколько последних токенов учитывать для штрафа за повторение. 0 = отключено, 2048 = последние ~2048 токенов (включая предыдущие сообщения в контексте)."
              value={customOverrides.rep_pen_range ?? effective.rep_pen_range}
              onChange={(v) => handleOverride('rep_pen_range', v)}
              modified={'rep_pen_range' in customOverrides}
              min={0}
              max={8192}
              step={128}
            />
            <ChatSettingSlider
              label="Presence Penalty"
              tooltip="Штраф за присутствие токена в предыдущем тексте. В отличие от Rep. Penalty, штрафует одинаково вне зависимости от количества повторений. 0 = выключено."
              value={customOverrides.presence_penalty ?? effective.presence_penalty}
              onChange={(v) => handleOverride('presence_penalty', v)}
              modified={'presence_penalty' in customOverrides}
              min={0}
              max={2}
              step={0.05}
            />
            <ChatSettingSlider
              label="Max Tokens"
              tooltip="Максимальная длина ответа модели в токенах. 1 токен ≈ 3–4 символа. 256 = короткий ответ, 512–1024 = развёрнутый. Для моделей с thinking (Qwen3) рекомендуется 4096–32768, т.к. размышления тоже расходуют токены."
              value={customOverrides.max_length ?? effective.max_length}
              onChange={(v) => handleOverride('max_length', v)}
              modified={'max_length' in customOverrides}
              min={64}
              max={32768}
              step={64}
            />
            {/* Context trim strategy */}
            <ContextTrimToggle
              value={customOverrides.context_trim_strategy ?? effective.context_trim_strategy}
              onChange={(v) => handleOverride('context_trim_strategy', v)}
              modified={'context_trim_strategy' in customOverrides}
            />
          </div>
        </div>

        {/* ── Model settings (context size) ── */}
        <ModelSettingsSection />

        {/* ── Scenario (read-only display) ── */}
        <ScenarioDisplay session={session} />

        {/* ── System prompt preview/editor ── */}
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
