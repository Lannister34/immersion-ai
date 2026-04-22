import type {
  ChatContextTrimStrategy,
  ChatGenerationSettingsDto,
  ChatSamplingOverridesDto,
  ChatSessionDto,
  UpdateChatGenerationSettingsCommand,
} from '@immersion/contracts/chats';
import type { SettingsOverviewResponse } from '@immersion/contracts/settings';
import { useState } from 'react';

interface ChatGenerationSettingsPanelProps {
  errorMessage: string | undefined;
  isSaving: boolean;
  isSettingsError: boolean;
  isSettingsLoading: boolean;
  onSave: (command: UpdateChatGenerationSettingsCommand) => Promise<void>;
  session: ChatSessionDto;
  settings: SettingsOverviewResponse | undefined;
}

interface ChatGenerationSettingsFormValues {
  contextTrimStrategy: ChatContextTrimStrategy | '';
  maxContextLength: string;
  maxTokens: string;
  minP: string;
  presencePenalty: string;
  repeatPenalty: string;
  repeatPenaltyRange: string;
  samplerPresetId: string;
  systemPrompt: string;
  temperature: string;
  topK: string;
  topP: string;
}

interface ParsedValue<TValue> {
  error: string | null;
  value: TValue;
}

const EMPTY_FORM_VALUES: ChatGenerationSettingsFormValues = {
  contextTrimStrategy: '',
  maxContextLength: '',
  maxTokens: '',
  minP: '',
  presencePenalty: '',
  repeatPenalty: '',
  repeatPenaltyRange: '',
  samplerPresetId: '',
  systemPrompt: '',
  temperature: '',
  topK: '',
  topP: '',
};

function numberToInput(value: number | null) {
  return value === null ? '' : String(value);
}

function toFormValues(settings: ChatGenerationSettingsDto): ChatGenerationSettingsFormValues {
  return {
    contextTrimStrategy: settings.sampling.contextTrimStrategy ?? '',
    maxContextLength: numberToInput(settings.sampling.maxContextLength),
    maxTokens: numberToInput(settings.sampling.maxTokens),
    minP: numberToInput(settings.sampling.minP),
    presencePenalty: numberToInput(settings.sampling.presencePenalty),
    repeatPenalty: numberToInput(settings.sampling.repeatPenalty),
    repeatPenaltyRange: numberToInput(settings.sampling.repeatPenaltyRange),
    samplerPresetId: settings.samplerPresetId ?? '',
    systemPrompt: settings.systemPrompt ?? '',
    temperature: numberToInput(settings.sampling.temperature),
    topK: numberToInput(settings.sampling.topK),
    topP: numberToInput(settings.sampling.topP),
  };
}

function parseNumberInput(value: string, label: string): ParsedValue<number | null> {
  const normalized = value.trim();

  if (!normalized) {
    return {
      error: null,
      value: null,
    };
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return {
      error: `${label}: введите число.`,
      value: null,
    };
  }

  return {
    error: null,
    value: parsed,
  };
}

function parsePositiveIntegerInput(value: string, label: string): ParsedValue<number | null> {
  const parsed = parseNumberInput(value, label);

  if (parsed.error || parsed.value === null) {
    return parsed;
  }

  if (!Number.isInteger(parsed.value) || parsed.value <= 0) {
    return {
      error: `${label}: нужно целое число больше 0.`,
      value: null,
    };
  }

  return parsed;
}

function parseNonNegativeIntegerInput(value: string, label: string): ParsedValue<number | null> {
  const parsed = parseNumberInput(value, label);

  if (parsed.error || parsed.value === null) {
    return parsed;
  }

  if (!Number.isInteger(parsed.value) || parsed.value < 0) {
    return {
      error: `${label}: нужно целое число не меньше 0.`,
      value: null,
    };
  }

  return parsed;
}

function parseNonNegativeNumberInput(value: string, label: string): ParsedValue<number | null> {
  const parsed = parseNumberInput(value, label);

  if (parsed.error || parsed.value === null) {
    return parsed;
  }

  if (parsed.value < 0) {
    return {
      error: `${label}: значение не может быть отрицательным.`,
      value: null,
    };
  }

  return parsed;
}

function createCommand(values: ChatGenerationSettingsFormValues): ParsedValue<UpdateChatGenerationSettingsCommand> {
  const maxContextLength = parsePositiveIntegerInput(values.maxContextLength, 'Размер контекста');
  const maxTokens = parsePositiveIntegerInput(values.maxTokens, 'Max tokens');
  const temperature = parseNonNegativeNumberInput(values.temperature, 'Temperature');
  const topP = parseNonNegativeNumberInput(values.topP, 'Top P');
  const topK = parseNonNegativeIntegerInput(values.topK, 'Top K');
  const minP = parseNonNegativeNumberInput(values.minP, 'Min P');
  const repeatPenalty = parseNonNegativeNumberInput(values.repeatPenalty, 'Repeat penalty');
  const repeatPenaltyRange = parseNonNegativeIntegerInput(values.repeatPenaltyRange, 'Repeat penalty range');
  const presencePenalty = parseNumberInput(values.presencePenalty, 'Presence penalty');
  const parseError =
    maxContextLength.error ??
    maxTokens.error ??
    temperature.error ??
    topP.error ??
    topK.error ??
    minP.error ??
    repeatPenalty.error ??
    repeatPenaltyRange.error ??
    presencePenalty.error;

  if (parseError) {
    return {
      error: parseError,
      value: {
        samplerPresetId: null,
        sampling: EMPTY_SAMPLING_OVERRIDES,
        systemPrompt: null,
      },
    };
  }

  return {
    error: null,
    value: {
      samplerPresetId: values.samplerPresetId || null,
      sampling: {
        contextTrimStrategy: values.contextTrimStrategy || null,
        maxContextLength: maxContextLength.value,
        maxTokens: maxTokens.value,
        minP: minP.value,
        presencePenalty: presencePenalty.value,
        repeatPenalty: repeatPenalty.value,
        repeatPenaltyRange: repeatPenaltyRange.value,
        temperature: temperature.value,
        topK: topK.value,
        topP: topP.value,
      },
      systemPrompt: values.systemPrompt.trim() || null,
    },
  };
}

const EMPTY_SAMPLING_OVERRIDES: ChatSamplingOverridesDto = {
  contextTrimStrategy: null,
  maxContextLength: null,
  maxTokens: null,
  minP: null,
  presencePenalty: null,
  repeatPenalty: null,
  repeatPenaltyRange: null,
  temperature: null,
  topK: null,
  topP: null,
};

function getPresetName(settings: SettingsOverviewResponse | undefined, presetId: string | null) {
  if (!settings) {
    return presetId ?? 'активный preset';
  }

  const resolvedPresetId = presetId ?? settings.sampler.activePresetId;

  return settings.sampler.presets.find((preset) => preset.id === resolvedPresetId)?.name ?? resolvedPresetId;
}

export function ChatGenerationSettingsPanel({
  errorMessage,
  isSaving,
  isSettingsError,
  isSettingsLoading,
  onSave,
  session,
  settings,
}: ChatGenerationSettingsPanelProps) {
  const [values, setValues] = useState(() => toFormValues(session.generationSettings));
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const effectivePresetName = getPresetName(settings, session.generationSettings.samplerPresetId);
  const selectedPresetIsMissing = Boolean(
    values.samplerPresetId &&
      settings &&
      !settings.sampler.presets.some((preset) => preset.id === values.samplerPresetId),
  );
  const updateField = <TField extends keyof ChatGenerationSettingsFormValues>(
    field: TField,
    value: ChatGenerationSettingsFormValues[TField],
  ) => {
    setSaved(false);
    setLocalError(null);
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <details className="panel chat-generation-settings-panel">
      <summary className="chat-generation-settings-summary">
        <span>
          <strong>Настройки генерации</strong>
          <small>Сейчас используется: {effectivePresetName}</small>
        </span>
      </summary>

      <form
        className="chat-generation-settings-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const command = createCommand(values);

          if (command.error) {
            setLocalError(command.error);
            setSaved(false);
            return;
          }

          try {
            await onSave(command.value);
            setSaved(true);
          } catch {
            setSaved(false);
          }
        }}
      >
        <label className="field field--span">
          <span className="field__label">Системный prompt чата</span>
          <textarea
            className="field__input field__input--textarea chat-generation-settings-form__prompt"
            maxLength={20_000}
            onChange={(event) => updateField('systemPrompt', event.target.value)}
            placeholder="Пусто = без системного prompt для этого чата"
            value={values.systemPrompt}
          />
          <span className="field__hint">
            Этот prompt применяется только к текущему чату и не меняет глобальные настройки.
          </span>
        </label>

        <label className="field">
          <span className="field__label">Sampler preset</span>
          <select
            className="field__input"
            disabled={isSettingsLoading || isSettingsError}
            onChange={(event) => updateField('samplerPresetId', event.target.value)}
            value={values.samplerPresetId}
          >
            <option value="">Наследовать активный preset</option>
            {selectedPresetIsMissing ? (
              <option value={values.samplerPresetId}>Недоступный preset: {values.samplerPresetId}</option>
            ) : null}
            {settings?.sampler.presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Стратегия обрезки</span>
          <select
            className="field__input"
            onChange={(event) => updateField('contextTrimStrategy', event.target.value as ChatContextTrimStrategy | '')}
            value={values.contextTrimStrategy}
          >
            <option value="">Наследовать из preset</option>
            <option value="trim_middle">Обрезать середину</option>
            <option value="trim_start">Обрезать начало</option>
          </select>
        </label>

        <label className="field">
          <span className="field__label">Размер контекста</span>
          <input
            className="field__input"
            inputMode="numeric"
            min={1}
            onChange={(event) => updateField('maxContextLength', event.target.value)}
            placeholder="Из preset"
            step={1}
            type="number"
            value={values.maxContextLength}
          />
        </label>

        <label className="field">
          <span className="field__label">Max tokens</span>
          <input
            className="field__input"
            inputMode="numeric"
            min={1}
            onChange={(event) => updateField('maxTokens', event.target.value)}
            placeholder="Из preset"
            step={1}
            type="number"
            value={values.maxTokens}
          />
        </label>

        <details className="chat-generation-settings-advanced field--span">
          <summary>Точные sampler overrides</summary>
          <div className="chat-generation-settings-grid">
            <label className="field">
              <span className="field__label">Temperature</span>
              <input
                className="field__input"
                min={0}
                onChange={(event) => updateField('temperature', event.target.value)}
                placeholder="Из preset"
                step="0.01"
                type="number"
                value={values.temperature}
              />
            </label>

            <label className="field">
              <span className="field__label">Top P</span>
              <input
                className="field__input"
                min={0}
                onChange={(event) => updateField('topP', event.target.value)}
                placeholder="Из preset"
                step="0.01"
                type="number"
                value={values.topP}
              />
            </label>

            <label className="field">
              <span className="field__label">Top K</span>
              <input
                className="field__input"
                inputMode="numeric"
                min={0}
                onChange={(event) => updateField('topK', event.target.value)}
                placeholder="Из preset"
                step={1}
                type="number"
                value={values.topK}
              />
            </label>

            <label className="field">
              <span className="field__label">Min P</span>
              <input
                className="field__input"
                min={0}
                onChange={(event) => updateField('minP', event.target.value)}
                placeholder="Из preset"
                step="0.01"
                type="number"
                value={values.minP}
              />
            </label>

            <label className="field">
              <span className="field__label">Repeat penalty</span>
              <input
                className="field__input"
                min={0}
                onChange={(event) => updateField('repeatPenalty', event.target.value)}
                placeholder="Из preset"
                step="0.01"
                type="number"
                value={values.repeatPenalty}
              />
            </label>

            <label className="field">
              <span className="field__label">Repeat range</span>
              <input
                className="field__input"
                inputMode="numeric"
                min={0}
                onChange={(event) => updateField('repeatPenaltyRange', event.target.value)}
                placeholder="Из preset"
                step={1}
                type="number"
                value={values.repeatPenaltyRange}
              />
            </label>

            <label className="field">
              <span className="field__label">Presence penalty</span>
              <input
                className="field__input"
                onChange={(event) => updateField('presencePenalty', event.target.value)}
                placeholder="Из preset"
                step="0.01"
                type="number"
                value={values.presencePenalty}
              />
            </label>
          </div>
        </details>

        {isSettingsError ? (
          <div className="note note--danger field--span">Не удалось загрузить список preset.</div>
        ) : null}
        {selectedPresetIsMissing ? (
          <div className="note note--danger field--span">
            Выбранный sampler preset больше недоступен. Выберите другой preset или сбросьте наследование.
          </div>
        ) : null}
        {localError ? <div className="note note--danger field--span">{localError}</div> : null}
        {errorMessage ? <div className="note note--danger field--span">{errorMessage}</div> : null}
        {saved ? <div className="form-status field--span">Настройки чата сохранены.</div> : null}

        <div className="actions field--span">
          <button className="action-button" disabled={isSaving} type="submit">
            {isSaving ? 'Сохраняем...' : 'Сохранить настройки'}
          </button>
          <button
            className="ghost-button"
            disabled={isSaving}
            onClick={() => {
              setValues(EMPTY_FORM_VALUES);
              setLocalError(null);
              setSaved(false);
            }}
            type="button"
          >
            Сбросить overrides
          </button>
        </div>
      </form>
    </details>
  );
}
