import {
  type ProviderConfig,
  type ProviderSettingsSnapshot,
  type ProviderType,
  type UpdateProviderSettingsCommand,
  UpdateProviderSettingsCommandSchema,
} from '@immersion/contracts/providers';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { ApiError } from '../../../shared/api/client';
import { ProviderFields } from './provider-fields';

function buildFormValues(snapshot: ProviderSettingsSnapshot): UpdateProviderSettingsCommand {
  const providerConfigs = snapshot.providerDefinitions.reduce<UpdateProviderSettingsCommand['providerConfigs']>(
    (result, definition) => {
      const defaults = definition.fields.reduce<Record<string, string>>((fieldValues, field) => {
        if (field.defaultValue) {
          fieldValues[field.key] = field.defaultValue;
        } else if (field.placeholder && field.required) {
          fieldValues[field.key] = field.placeholder;
        }

        return fieldValues;
      }, {});

      result[definition.type] = {
        ...defaults,
        ...(snapshot.providerConfigs[definition.type] ?? {}),
      } as ProviderConfig;

      return result;
    },
    {},
  );

  return {
    mode: snapshot.mode,
    activeProvider: snapshot.activeProvider,
    providerConfigs,
  };
}

function getValidationMessage(result: ReturnType<typeof UpdateProviderSettingsCommandSchema.safeParse>) {
  if (result.success) {
    return null;
  }

  return result.error.issues[0]?.message ?? 'Не удалось провалидировать конфигурацию провайдера.';
}

interface ProviderSettingsFormProps {
  isSaving: boolean;
  onSubmit: (command: UpdateProviderSettingsCommand) => Promise<void>;
  snapshot: ProviderSettingsSnapshot;
}

export function ProviderSettingsForm({ isSaving, onSubmit, snapshot }: ProviderSettingsFormProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<UpdateProviderSettingsCommand>({
    defaultValues: buildFormValues(snapshot),
  });
  const mode = form.watch('mode', snapshot.mode);
  const activeProvider = form.watch('activeProvider', snapshot.activeProvider);
  const selectedProvider: ProviderType = mode === 'builtin' ? 'koboldcpp' : activeProvider;
  const selectedDefinition =
    snapshot.providerDefinitions.find((definition) => definition.type === selectedProvider) ??
    snapshot.providerDefinitions[0]!;

  const handleModeChange = (nextMode: UpdateProviderSettingsCommand['mode']) => {
    setStatusMessage(null);
    setErrorMessage(null);
    form.setValue('mode', nextMode, { shouldDirty: true });

    if (nextMode === 'builtin') {
      form.setValue('activeProvider', 'koboldcpp', { shouldDirty: true });
      return;
    }

    if (form.getValues('activeProvider') === 'koboldcpp') {
      form.setValue('activeProvider', 'custom', { shouldDirty: true });
    }
  };

  const handleProviderChange = (provider: ProviderType) => {
    setStatusMessage(null);
    setErrorMessage(null);
    form.setValue('activeProvider', provider, { shouldDirty: true });
  };

  const submit = form.handleSubmit(async (values) => {
    setStatusMessage(null);
    setErrorMessage(null);

    const parsed = UpdateProviderSettingsCommandSchema.safeParse(values);
    const validationMessage = getValidationMessage(parsed);

    if (!parsed.success) {
      setErrorMessage(validationMessage);
      return;
    }

    try {
      await onSubmit(parsed.data);
      form.reset(parsed.data);
      setStatusMessage('Каноническая конфигурация провайдера сохранена.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить конфигурацию провайдера.');
    }
  });

  return (
    <section className="panel">
      <div className="panel__eyebrow">provider settings</div>
      <h1 className="panel__title">Режим провайдера и подключение</h1>
      <p className="panel__description">
        Экран редактирует только backend-owned provider settings. После сохранения UI получает обратно канонический
        snapshot из API и не хранит собственную durable-копию.
      </p>

      <form className="stack" onSubmit={submit}>
        <div className="field">
          <span className="field__label">Режим backend</span>
          <div aria-label="Режим backend" className="segmented" role="group">
            <button
              aria-pressed={mode === 'builtin'}
              className={`segmented__button ${mode === 'builtin' ? 'segmented__button--active' : ''}`}
              onClick={() => handleModeChange('builtin')}
              type="button"
            >
              Встроенный
            </button>
            <button
              aria-pressed={mode === 'external'}
              className={`segmented__button ${mode === 'external' ? 'segmented__button--active' : ''}`}
              onClick={() => handleModeChange('external')}
              type="button"
            >
              Внешний
            </button>
          </div>
        </div>

        <div className="field">
          <span className="field__label">Активный провайдер</span>
          <div aria-label="Активный провайдер" className="segmented" role="group">
            {snapshot.providerDefinitions.map((definition) => {
              const isActive = selectedProvider === definition.type;
              const isDisabled = mode === 'builtin' && definition.type !== 'koboldcpp';

              return (
                <button
                  aria-pressed={isActive}
                  className={`segmented__button ${isActive ? 'segmented__button--active' : ''}`}
                  disabled={isDisabled}
                  key={definition.type}
                  onClick={() => handleProviderChange(definition.type)}
                  type="button"
                >
                  {definition.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-grid">
          <ProviderFields definition={selectedDefinition} provider={selectedProvider} register={form.register} />
        </div>

        <div className="note">
          Секреты сохраняются только в каноническом файле настроек backend. Форма не делает ручной merge состояния и не
          синхронизирует durable data через Zustand.
        </div>

        <div className="actions">
          <button className="action-button" disabled={isSaving || !form.formState.isDirty} type="submit">
            {isSaving ? 'Сохранение...' : 'Сохранить конфигурацию'}
          </button>
          {statusMessage ? <span className="form-status">{statusMessage}</span> : null}
          {errorMessage ? <span className="form-status form-status--error">{errorMessage}</span> : null}
        </div>
      </form>
    </section>
  );
}
