import type { ProviderDefinition, ProviderType, UpdateProviderSettingsCommand } from '@immersion/contracts/providers';
import type { Path, UseFormRegister } from 'react-hook-form';

function getFieldLabel(key: string) {
  switch (key) {
    case 'url':
      return 'URL';
    case 'apiKey':
      return 'API-ключ';
    case 'model':
      return 'Модель';
    default:
      return key;
  }
}

function getFieldInputType(type: 'text' | 'password', key: string) {
  if (type === 'password') {
    return 'password';
  }

  if (key === 'url') {
    return 'url';
  }

  return 'text';
}

interface ProviderFieldsProps {
  definition: ProviderDefinition;
  disabled?: boolean;
  provider: ProviderType;
  register: UseFormRegister<UpdateProviderSettingsCommand>;
}

export function ProviderFields({ definition, disabled = false, provider, register }: ProviderFieldsProps) {
  return (
    <>
      {definition.fields.map((field) => {
        const fieldName = `providerConfigs.${provider}.${field.key}` as Path<UpdateProviderSettingsCommand>;

        return (
          <label className="field" key={field.key}>
            <span className="field__label">{getFieldLabel(field.key)}</span>
            <input
              {...register(fieldName)}
              className="field__input"
              disabled={disabled}
              placeholder={field.placeholder}
              required={field.required}
              type={getFieldInputType(field.type, field.key)}
            />
          </label>
        );
      })}
    </>
  );
}
