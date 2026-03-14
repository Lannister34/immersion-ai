import { clsx } from 'clsx';
import { forwardRef, type SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, className, children, ...props }, ref) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm text-[var(--color-text-muted)] font-medium">{label}</label>}
      <select
        ref={ref}
        className={clsx(
          'w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer appearance-none',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
});

Select.displayName = 'Select';
