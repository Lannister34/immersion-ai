import { Check, FileText, Info, Link, Pencil, Plus, RotateCcw, Save, Sliders, Trash2, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import type { UiLanguage } from '@/i18n';
import { DEFAULT_SAMPLER_SETTINGS, getDefaultSystemPrompt, syncToServerNow, useAppStore } from '@/stores';
import type { ContextTrimStrategy, SamplerPreset, SamplerSettings } from '@/types';

function SamplerSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  hint?: string;
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <div className="relative flex items-center gap-1">
          <label
            className="text-xs text-[var(--color-text-muted)] cursor-help"
            onMouseEnter={() => tooltip && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {label}
          </label>
          {showTooltip && tooltip && (
            <div className="absolute left-0 bottom-full mb-1 z-50 w-[min(15rem,calc(100vw-2rem))] px-2.5 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-lg text-[11px] leading-snug text-[var(--color-text-muted)] pointer-events-none">
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
          className="w-20 text-right bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-1.5 bg-[var(--color-surface-2)] rounded-full appearance-none cursor-pointer accent-[var(--color-primary)]"
      />
      {hint && <span className="text-[10px] text-[var(--color-text-muted)] opacity-60">{hint}</span>}
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const {
    connection,
    userName,
    setUserName,
    userPersona,
    setUserPersona,
    samplerPresets,
    activePresetId,
    addPreset,
    updatePreset,
    renamePreset,
    deletePreset,
    setActivePreset,
    modelPresetMap,
    setModelPreset,
    systemPromptTemplate,
    setSystemPromptTemplate,
    responseLanguage,
    setResponseLanguage,
    streamingEnabled,
    setStreamingEnabled,
    thinkingEnabled,
    setThinkingEnabled,
    uiLanguage,
    setUiLanguage,
  } = useAppStore();
  const [localUserName, setLocalUserName] = useState(userName);
  const [localPersona, setLocalPersona] = useState(userPersona);
  const [localPrompt, setLocalPrompt] = useState(systemPromptTemplate);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Sync local state when store changes (e.g., after initSettingsFromServer loads from server)
  useEffect(() => {
    setLocalUserName(userName);
  }, [userName]);
  useEffect(() => {
    setLocalPersona(userPersona);
  }, [userPersona]);
  useEffect(() => {
    setLocalPrompt(systemPromptTemplate);
  }, [systemPromptTemplate]);

  const activePreset = samplerPresets.find((p) => p.id === activePresetId) ?? samplerPresets[0];

  const showSaved = (section: string) => {
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 2000);
  };

  const handleSavePersona = async () => {
    setUserName(localUserName);
    setUserPersona(localPersona);
    try {
      await syncToServerNow();
      showSaved('persona');
    } catch (err) {
      console.error('Failed to save persona to server:', err);
      showSaved('persona'); // still show saved — store already has the value
    }
  };

  const handleSavePrompt = async () => {
    setSystemPromptTemplate(localPrompt);
    try {
      await syncToServerNow();
      showSaved('prompt');
    } catch (err) {
      console.error('Failed to save prompt to server:', err);
      showSaved('prompt');
    }
  };

  const handleResetPrompt = async () => {
    const defaultPrompt = getDefaultSystemPrompt(responseLanguage);
    setLocalPrompt(defaultPrompt);
    setSystemPromptTemplate(defaultPrompt);
    try {
      await syncToServerNow();
    } catch {
      /* ignore */
    }
    showSaved('prompt');
  };

  const handleSamplerChange = (key: keyof SamplerSettings, value: SamplerSettings[keyof SamplerSettings]) => {
    updatePreset(activePreset.id, { [key]: value });
  };

  const handleResetPreset = () => {
    updatePreset(activePreset.id, DEFAULT_SAMPLER_SETTINGS);
    showSaved('samplers');
  };

  const handleCreatePreset = () => {
    const id = `preset-${Date.now()}`;
    const newPreset: SamplerPreset = {
      id,
      name: t('settings.newPresetName', { number: samplerPresets.length + 1 }),
      ...DEFAULT_SAMPLER_SETTINGS,
    };
    addPreset(newPreset);
    setActivePreset(id);
  };

  const handleDeletePreset = () => {
    if (samplerPresets.length <= 1) return;
    deletePreset(activePreset.id);
  };

  const startRename = () => {
    setRenamingPresetId(activePreset.id);
    setRenameValue(activePreset.name);
  };

  const commitRename = () => {
    if (renamingPresetId && renameValue.trim()) {
      renamePreset(renamingPresetId, renameValue.trim());
    }
    setRenamingPresetId(null);
  };

  // Collect known models: from modelPresetMap keys + current connection
  const knownModels = new Set(Object.keys(modelPresetMap));
  if (connection.connected && connection.model) {
    knownModels.add(connection.model);
  }

  const uiLangOptions: { value: UiLanguage; label: string }[] = [
    { value: 'ru', label: 'RU' },
    { value: 'en', label: 'EN' },
  ];

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 sm:gap-6 pb-8 flex-1 overflow-y-auto p-3 sm:p-5">
      {/* User Persona section */}
      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 sm:p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <User size={15} className="text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('settings.userPersonaTitle')}</h2>
        </div>

        <div>
          <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">{t('settings.nameLabel')}</label>
          <input
            type="text"
            value={localUserName}
            onChange={(e) => setLocalUserName(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors"
            placeholder={t('settings.namePlaceholder')}
          />
        </div>

        <div>
          <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">
            {t('settings.personaDescriptionLabel')}
          </label>
          <textarea
            value={localPersona}
            onChange={(e) => setLocalPersona(e.target.value)}
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors resize-none min-h-24"
            placeholder={t('settings.personaDescriptionPlaceholder')}
            rows={4}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSavePersona}>
            <Save size={13} />
            {t('common.save')}
          </Button>
          {savedSection === 'persona' && (
            <span className="text-xs text-[var(--color-accent)] animate-pulse">{t('common.saved')}</span>
          )}
        </div>
      </section>

      {/* System Prompt section */}
      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 sm:p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('settings.systemPromptTitle')}</h2>
        </div>

        <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] rounded-lg px-3 py-2">
          {t('settings.variablesLabel')} <code className="text-[var(--color-primary)]">{'{{char}}'}</code>,{' '}
          <code className="text-[var(--color-primary)]">{'{{user}}'}</code>,{' '}
          <code className="text-[var(--color-primary)]">{'{{description}}'}</code>,{' '}
          <code className="text-[var(--color-primary)]">{'{{personality}}'}</code>,{' '}
          <code className="text-[var(--color-primary)]">{'{{scenario}}'}</code>,{' '}
          <code className="text-[var(--color-primary)]">{'{{userPersona}}'}</code>
        </div>

        <textarea
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors resize-none font-mono leading-relaxed"
          rows={12}
        />

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleSavePrompt}>
            <Save size={13} />
            {t('common.save')}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleResetPrompt}>
            <RotateCcw size={13} />
            {t('common.reset')}
          </Button>
          {savedSection === 'prompt' && (
            <span className="text-xs text-[var(--color-accent)] animate-pulse">{t('common.saved')}</span>
          )}
        </div>

        {/* UI Language */}
        <div className="border-t border-[var(--color-border)] pt-4 flex flex-col gap-2">
          <label className="text-xs font-medium text-[var(--color-text-muted)]">{t('settings.uiLanguage')}</label>
          <p className="text-[10px] text-[var(--color-text-muted)] opacity-60">{t('settings.uiLanguageHint')}</p>
          <div className="flex items-center gap-1 bg-[var(--color-surface-2)] rounded-lg p-0.5 w-fit">
            {uiLangOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setUiLanguage(value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  uiLanguage === value
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Response Language */}
        <div className="border-t border-[var(--color-border)] pt-4 flex flex-col gap-2">
          <label className="text-xs font-medium text-[var(--color-text-muted)]">
            {t('settings.responseLanguageLabel')}
          </label>
          <p className="text-[10px] text-[var(--color-text-muted)] opacity-60">{t('settings.responseLanguageHint')}</p>
          <div className="flex items-center gap-1 bg-[var(--color-surface-2)] rounded-lg p-0.5 w-fit">
            {(
              [
                ['ru', 'RU'],
                ['en', 'EN'],
                ['none', t('settings.responseLanguageAuto')],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setResponseLanguage(val)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  responseLanguage === val
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] pt-4 flex items-center justify-between">
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">{t('settings.streamingLabel')}</label>
            <p className="text-[10px] text-[var(--color-text-muted)] opacity-60 mt-0.5">
              {t('settings.streamingHint')}
            </p>
          </div>
          <button
            onClick={() => setStreamingEnabled(!streamingEnabled)}
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
              streamingEnabled
                ? 'bg-[var(--color-primary)]'
                : 'bg-[var(--color-surface-2)] border border-[var(--color-border)]'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                streamingEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="border-t border-[var(--color-border)] pt-4 flex items-center justify-between">
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">{t('settings.thinkingLabel')}</label>
            <p className="text-[10px] text-[var(--color-text-muted)] opacity-60 mt-0.5">{t('settings.thinkingHint')}</p>
          </div>
          <button
            onClick={() => setThinkingEnabled(!thinkingEnabled)}
            className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
              thinkingEnabled
                ? 'bg-[var(--color-primary)]'
                : 'bg-[var(--color-surface-2)] border border-[var(--color-border)]'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                thinkingEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Sampler Presets section */}
      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 sm:p-5 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={15} className="text-[var(--color-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('settings.samplerPresetsTitle')}</h2>
          </div>
        </div>

        {/* Preset selector toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activePreset.id}
            onChange={(e) => setActivePreset(e.target.value)}
            className="flex-1 min-w-[160px] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] cursor-pointer"
          >
            {samplerPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <Button size="sm" variant="ghost" onClick={handleCreatePreset} title={t('settings.createPresetTooltip')}>
            <Plus size={13} />
          </Button>

          {renamingPresetId === activePreset.id ? (
            <div className="flex items-center gap-1">
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingPresetId(null);
                }}
                autoFocus
                className="w-32 bg-[var(--color-surface-2)] border border-[var(--color-primary)] rounded px-2 py-1 text-xs text-[var(--color-text)] outline-none"
              />
              <button
                onClick={commitRename}
                className="p-1 rounded hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] cursor-pointer"
              >
                <Check size={12} />
              </button>
              <button
                onClick={() => setRenamingPresetId(null)}
                className="p-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={startRename} title={t('common.rename')}>
              <Pencil size={13} />
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDeletePreset}
            disabled={samplerPresets.length <= 1}
            title={t('settings.deletePresetTooltip')}
          >
            <Trash2 size={13} />
          </Button>

          <div className="h-4 w-px bg-[var(--color-border)]" />

          <Button size="sm" variant="ghost" onClick={handleResetPreset} title={t('settings.resetValuesTooltip')}>
            <RotateCcw size={13} />
            {t('settings.resetToDefaults')}
          </Button>
          {savedSection === 'samplers' && (
            <span className="text-xs text-[var(--color-accent)] animate-pulse">{t('common.resetDone')}</span>
          )}
        </div>

        {/* Sampler sliders for active preset */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SamplerSlider
            label="Temperature"
            tooltip={t('samplers.temperatureTooltip')}
            value={activePreset.temperature}
            onChange={(v) => handleSamplerChange('temperature', v)}
            min={0.1}
            max={2.0}
            step={0.05}
            hint={t('samplers.temperatureHint')}
          />
          <SamplerSlider
            label="Min P"
            tooltip={t('samplers.minPTooltip')}
            value={activePreset.min_p}
            onChange={(v) => handleSamplerChange('min_p', v)}
            min={0}
            max={0.5}
            step={0.01}
            hint={t('samplers.minPHint')}
          />
          <SamplerSlider
            label="Top P"
            tooltip={t('samplers.topPTooltip')}
            value={activePreset.top_p}
            onChange={(v) => handleSamplerChange('top_p', v)}
            min={0}
            max={1}
            step={0.05}
            hint={t('samplers.topPHint')}
          />
          <SamplerSlider
            label="Top K"
            tooltip={t('samplers.topKTooltip')}
            value={activePreset.top_k}
            onChange={(v) => handleSamplerChange('top_k', v)}
            min={0}
            max={200}
            step={1}
            hint={t('samplers.topKHint')}
          />
          <SamplerSlider
            label="Rep. Penalty"
            tooltip={t('samplers.repPenTooltip')}
            value={activePreset.rep_pen}
            onChange={(v) => handleSamplerChange('rep_pen', v)}
            min={1}
            max={1.5}
            step={0.01}
            hint={t('samplers.repPenHint')}
          />
          <SamplerSlider
            label="Rep. Pen. Range"
            tooltip={t('samplers.repPenRangeTooltip')}
            value={activePreset.rep_pen_range}
            onChange={(v) => handleSamplerChange('rep_pen_range', v)}
            min={0}
            max={8192}
            step={128}
            hint={t('samplers.repPenRangeHint')}
          />
          <SamplerSlider
            label="Presence Penalty"
            tooltip={t('samplers.presencePenaltyTooltip')}
            value={activePreset.presence_penalty}
            onChange={(v) => handleSamplerChange('presence_penalty', v)}
            min={0}
            max={2}
            step={0.05}
            hint={t('samplers.presencePenaltyHint')}
          />
          <SamplerSlider
            label="Max Tokens"
            tooltip={t('samplers.maxTokensTooltip')}
            value={activePreset.max_length}
            onChange={(v) => handleSamplerChange('max_length', v)}
            min={64}
            max={32768}
            step={64}
            hint={t('samplers.maxTokensHint')}
          />
          <SamplerSlider
            label="Context Size"
            tooltip={t('samplers.contextSizeTooltip')}
            value={activePreset.max_context_length}
            onChange={(v) => handleSamplerChange('max_context_length', v)}
            min={2048}
            max={131072}
            step={1024}
            hint={t('samplers.contextSizeHint')}
          />

          {/* Context trim strategy */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--color-text-muted)]">{t('samplers.contextTrimLabel')}</label>
              <span className="text-[9px] text-[var(--color-text-muted)] opacity-50">
                {t('samplers.contextTrimHintShort')}
              </span>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)] w-fit">
              {[
                {
                  key: 'trim_start' as ContextTrimStrategy,
                  label: t('samplers.trimStart'),
                  hint: t('samplers.trimStartHint'),
                },
                {
                  key: 'trim_middle' as ContextTrimStrategy,
                  label: t('samplers.trimMiddle'),
                  hint: t('samplers.trimMiddleHint'),
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleSamplerChange('context_trim_strategy', opt.key)}
                  title={opt.hint}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    activePreset.context_trim_strategy === opt.key
                      ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Model → Preset mapping section */}
      {knownModels.size > 0 && (
        <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Link size={15} className="text-[var(--color-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('settings.modelPresetMappingTitle')}</h2>
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">{t('settings.modelPresetMappingHint')}</div>
          <div className="flex flex-col gap-2">
            {[...knownModels].map((model) => (
              <div key={model} className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-text)] font-mono bg-[var(--color-surface-2)] px-2 py-1 rounded flex-1 min-w-0 truncate">
                  {model}
                </span>
                <select
                  value={modelPresetMap[model] ?? ''}
                  onChange={(e) => setModelPreset(model, e.target.value || null)}
                  className="w-40 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] cursor-pointer"
                >
                  <option value="">{t('settings.presetNotSet')}</option>
                  {samplerPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Info section */}
      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Info size={15} className="text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('settings.aboutTitle')}</h2>
        </div>
        <div className="text-xs text-[var(--color-text-muted)] flex flex-col gap-1.5">
          <div>{t('settings.aboutDescription')}</div>
          <div>
            {t('settings.aboutBackend')}{' '}
            <span className="font-mono bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">http://localhost:8000</span>
          </div>
          <div>{t('settings.aboutFrontend')}</div>
          <div>{t('settings.aboutState')}</div>
        </div>
      </section>
    </div>
  );
}
