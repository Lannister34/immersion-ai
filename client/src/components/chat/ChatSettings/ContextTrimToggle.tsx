import { clsx } from 'clsx';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContextTrimStrategy } from '@/types';

const OPTION_KEYS: { key: ContextTrimStrategy; labelKey: 'samplers.trimStart' | 'samplers.trimMiddle' }[] = [
  { key: 'trim_start', labelKey: 'samplers.trimStart' },
  { key: 'trim_middle', labelKey: 'samplers.trimMiddle' },
];

interface ContextTrimToggleProps {
  value: ContextTrimStrategy;
  onChange: (v: ContextTrimStrategy) => void;
  modified?: boolean;
}

export function ContextTrimToggle({ value, onChange, modified }: ContextTrimToggleProps) {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = useState(false);

  const handleShowTooltip = useCallback(() => {
    setShowTooltip(true);
  }, []);

  const handleHideTooltip = useCallback(() => {
    setShowTooltip(false);
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center gap-1">
        <label
          className={clsx(
            'text-[10px] cursor-help',
            modified ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]',
          )}
          onMouseEnter={handleShowTooltip}
          onMouseLeave={handleHideTooltip}
        >
          {t('samplers.contextTrimLabel')}
        </label>
        {showTooltip && (
          <div className="absolute left-0 bottom-full mb-1 z-50 w-[min(13rem,calc(100vw-2rem))] px-2.5 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-lg text-[10px] leading-snug text-[var(--color-text-muted)] pointer-events-none">
            {t('samplers.contextTrimTooltip')}
          </div>
        )}
      </div>
      <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
        {OPTION_KEYS.map((opt) => (
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
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
