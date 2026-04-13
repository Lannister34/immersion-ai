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
    mode: 'external',
    activeProvider: snapshot.activeProvider,
    providerConfigs,
  };
}

function getValidationMessage(result: ReturnType<typeof UpdateProviderSettingsCommandSchema.safeParse>) {
  if (result.success) {
    return null;
  }

  return result.error.issues[0]?.message ?? 'Не удалось проверить настройки подключения.';
}

function removeEmptyProviderValues(command: UpdateProviderSettingsCommand): UpdateProviderSettingsCommand {
  return {
    ...command,
    providerConfigs: Object.fromEntries(
      Object.entries(command.providerConfigs).map(([provider, config]) => [
        provider,
        Object.fromEntries(
          Object.entries(config ?? {}).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
        ),
      ]),
    ),
  };
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
  const selectedProvider: ProviderType = form.watch('activeProvider', snapshot.activeProvider);
  const selectedDefinition =
    snapshot.providerDefinitions.find((definition) => definition.type === selectedProvider) ??
    snapshot.providerDefinitions[0]!;

  const handleProviderChange = (provider: ProviderType) => {
    setStatusMessage(null);
    setErrorMessage(null);
    form.setValue('activeProvider', provider, { shouldDirty: true });
  };

  const submit = form.handleSubmit(async (values) => {
    setStatusMessage(null);
    setErrorMessage(null);

    const parsed = UpdateProviderSettingsCommandSchema.safeParse(
      removeEmptyProviderValues({
        ...values,
        mode: 'external',
      }),
    );
    const validationMessage = getValidationMessage(parsed);

    if (!parsed.success) {
      setErrorMessage(validationMessage);
      return;
    }

    try {
      await onSubmit(parsed.data);
      form.reset(parsed.data);
      setStatusMessage('Настройки внешнего API сохранены.');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : 'Не удалось сохранить настройки внешнего API.');
    }
  });

  return (
    <section className="panel">
      <h1 className="panel__title panel__title--secondary">Внешний API</h1>

      <form className="stack" onSubmit={submit}>
        <div className="field">
          <span className="field__label">Провайдер</span>
          <div aria-label="Провайдер" className="segmented" role="group">
            {snapshot.providerDefinitions.map((definition) => {
              const isActive = selectedProvider === definition.type;

              return (
                <button
                  aria-pressed={isActive}
                  className={`segmented__button ${isActive ? 'segmented__button--active' : ''}`}
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

        <div className="actions">
          <button className="action-button" disabled={isSaving || !form.formState.isDirty} type="submit">
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {statusMessage ? <span className="form-status">{statusMessage}</span> : null}
          {errorMessage ? <span className="form-status form-status--error">{errorMessage}</span> : null}
        </div>
      </form>
    </section>
  );
}
