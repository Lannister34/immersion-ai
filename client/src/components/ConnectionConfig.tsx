import { Eye, EyeOff } from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getProviderDefinitions } from '@/api';
import { useAppStore } from '@/stores';
import type { ProviderConfig, ProviderDefinition, ProviderFieldDef, ProviderType } from '@/types';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

// ── Field label mapping (key → i18n key) ────────────────────────────────────

const FIELD_I18N_KEYS: Record<string, string> = {
  url: 'server.fieldUrl',
  apiKey: 'server.fieldApiKey',
};

// ── Password field with show/hide toggle ────────────────────────────────────

interface PasswordFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function PasswordField({ label, value, placeholder, onChange, onBlur }: PasswordFieldProps) {
  const [showValue, setShowValue] = useState(false);

  const handleToggle = useCallback(() => {
    setShowValue((prev) => !prev);
  }, []);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-[var(--color-text-muted)] font-medium">{label}</label>
      <div className="relative">
        <input
          type={showValue ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 pr-10 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
        />
        <button
          type="button"
          onClick={handleToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
        >
          {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

// ── Dynamic provider field ──────────────────────────────────────────────────

interface ProviderFieldProps {
  field: ProviderFieldDef;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function ProviderField({ field, label, value, onChange, onBlur }: ProviderFieldProps) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  if (field.type === 'password') {
    return (
      <PasswordField label={label} value={value} placeholder={field.placeholder} onChange={onChange} onBlur={onBlur} />
    );
  }

  return <Input label={label} value={value} onChange={handleChange} onBlur={onBlur} placeholder={field.placeholder} />;
}

// ── Main component ──────────────────────────────────────────────────────────

export function ConnectionConfig() {
  const { t } = useTranslation();
  const { activeProvider, providerConfigs, setActiveProvider, updateProviderConfig } = useAppStore();
  const config: ProviderConfig = providerConfigs[activeProvider] ?? { url: 'http://127.0.0.1:5001' };

  // Fetch provider definitions from backend
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  useEffect(() => {
    getProviderDefinitions().then(setProviders).catch(console.error);
  }, []);

  const activeDef = providers.find((p) => p.type === activeProvider);

  // Local form state — committed to store on blur
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // Re-init local form state when provider switches or store config changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-run when activeProvider changes
  useEffect(() => {
    if (!activeDef) return;
    const values: Record<string, string> = {};
    for (const field of activeDef.fields) {
      values[field.key] = (config as Record<string, string | undefined>)[field.key] ?? field.defaultValue ?? '';
    }
    setFormValues(values);
  }, [activeProvider, activeDef, config]);

  const handleProviderChange = useCallback(
    (value: string) => {
      setActiveProvider(value as ProviderType);
    },
    [setActiveProvider],
  );

  const providerOptions = useMemo(
    () => providers.map((p) => ({ value: p.type, label: t(`server.provider_${p.type}`, p.label) })),
    [providers, t],
  );

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleFieldBlur = useCallback(
    (key: string) => {
      const value = formValues[key]?.trim();
      const current = (config as Record<string, string | undefined>)[key];
      if (value !== current) {
        updateProviderConfig(activeProvider, { [key]: value || undefined });
      }
    },
    [formValues, config, activeProvider, updateProviderConfig],
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
        {t('server.connectionTitle')}
      </h3>

      <Select
        label={t('server.providerLabel')}
        value={activeProvider}
        options={providerOptions}
        onChange={handleProviderChange}
      />

      {activeDef?.fields.map((field) => (
        <ProviderField
          key={field.key}
          field={field}
          label={t(FIELD_I18N_KEYS[field.key] ?? field.key)}
          value={formValues[field.key] ?? ''}
          onChange={(v) => handleFieldChange(field.key, v)}
          onBlur={() => handleFieldBlur(field.key)}
        />
      ))}
    </div>
  );
}
