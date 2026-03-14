import { clsx } from 'clsx';
import { Check, X } from 'lucide-react';
import type { JSX } from 'react';

interface MessageEditFormProps {
  editText: string;
  editRef: React.RefObject<HTMLTextAreaElement | null>;
  isUser: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function MessageEditForm({
  editText,
  editRef,
  isUser,
  onChange,
  onKeyDown,
  onSave,
  onCancel,
}: MessageEditFormProps): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={editRef}
        value={editText}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className={clsx(
          'w-full resize-none rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]',
          isUser
            ? 'bg-white/15 text-white placeholder:text-white/50'
            : 'bg-[var(--color-background)] text-[var(--color-text)] border border-[var(--color-border)]',
        )}
        rows={1}
      />
      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={onSave}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium hover:brightness-110 transition-all cursor-pointer"
          title="Сохранить (Ctrl+Enter)"
        >
          <Check size={13} />
          <span>Сохранить</span>
        </button>
        <button
          onClick={onCancel}
          className={clsx(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
            isUser
              ? 'text-white/70 hover:text-white hover:bg-white/10'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]',
          )}
          title="Отмена (Esc)"
        >
          <X size={13} />
          <span>Отмена</span>
        </button>
      </div>
    </div>
  );
}
