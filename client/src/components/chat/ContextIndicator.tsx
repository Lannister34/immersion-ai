import { clsx } from 'clsx';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface ContextIndicatorProps {
  promptLength: number;
  maxContext: number;
}

export function ContextIndicator({ promptLength, maxContext }: ContextIndicatorProps): JSX.Element | null {
  const { t } = useTranslation();
  if (promptLength === 0) return null;

  // Rough estimate: ~3.5 chars per token for mixed Russian/English
  const estimatedTokens = Math.round(promptLength / 3.5);
  const ratio = estimatedTokens / maxContext;
  const percent = Math.round(ratio * 100);
  const isOverflow = ratio > 1;

  const formatTokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  const barColor =
    isOverflow || percent > 90
      ? 'bg-[var(--color-danger)]'
      : percent > 70
        ? 'bg-yellow-500'
        : 'bg-[var(--color-primary)]';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] tabular-nums"
      title={
        t('context.tooltipNormal', {
          estimatedTokens: formatTokens(estimatedTokens),
          maxContext: formatTokens(maxContext),
          percent,
        }) + (isOverflow ? t('context.tooltipOverflow') : '')
      }
    >
      <span className="w-14 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden inline-block align-middle">
        <span
          className={clsx('block h-full rounded-full transition-all duration-300', barColor)}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </span>
      <span className={isOverflow ? 'text-[var(--color-danger)]' : ''}>
        {formatTokens(estimatedTokens)}/{formatTokens(maxContext)}
      </span>
    </span>
  );
}
