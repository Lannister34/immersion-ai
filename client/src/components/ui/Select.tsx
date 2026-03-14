import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Select({ label, value, options, onChange, placeholder, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        // Opening: highlight current value
        const idx = options.findIndex((o) => o.value === value);
        setHighlightedIndex(idx >= 0 ? idx : 0);
      }
      return !prev;
    });
  }, [options, value]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setOpen(false);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen(true);
          const idx = options.findIndex((o) => o.value === value);
          setHighlightedIndex(idx >= 0 ? idx : 0);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < options.length) {
            handleSelect(options[highlightedIndex].value);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, options, value, highlightedIndex, handleSelect],
  );

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm text-[var(--color-text-muted)] font-medium">{label}</label>}
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className={clsx(
            'w-full flex items-center justify-between bg-[var(--color-surface-2)] border rounded-lg px-3 py-2 text-sm text-left outline-none transition-colors cursor-pointer',
            open ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]',
            className,
          )}
        >
          <span className={selectedOption ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}>
            {selectedOption?.label ?? placeholder ?? ''}
          </span>
          <ChevronDown
            size={14}
            className={clsx('text-[var(--color-text-muted)] transition-transform duration-200', open && 'rotate-180')}
          />
        </button>

        {open && (
          <ul className="absolute top-full left-0 right-0 mt-1 z-50 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
            {options.map((opt, idx) => (
              <li
                key={opt.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt.value);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={clsx(
                  'px-3 py-2 text-sm cursor-pointer transition-colors',
                  opt.value === value ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]',
                  idx === highlightedIndex && 'bg-[var(--color-surface)]',
                )}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
