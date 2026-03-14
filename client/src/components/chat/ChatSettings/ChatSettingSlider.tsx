import { clsx } from 'clsx';
import { useCallback, useState } from 'react';

interface ChatSettingSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  hint?: string;
  modified?: boolean;
  tooltip?: string;
}

export function ChatSettingSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  modified,
  tooltip,
}: ChatSettingSliderProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleShowTooltip = useCallback(() => {
    if (tooltip) setShowTooltip(true);
  }, [tooltip]);

  const handleHideTooltip = useCallback(() => {
    setShowTooltip(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-center">
        <div className="relative flex items-center gap-1">
          <label
            className={clsx(
              'text-[10px] cursor-help',
              modified ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]',
            )}
            onMouseEnter={handleShowTooltip}
            onMouseLeave={handleHideTooltip}
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
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          className="w-16 text-right bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>
      <input
        type="range"
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        className="w-full h-1 bg-[var(--color-surface-2)] rounded-full appearance-none cursor-pointer accent-[var(--color-primary)]"
      />
      {hint && <span className="text-[9px] text-[var(--color-text-muted)] opacity-50">{hint}</span>}
    </div>
  );
}
