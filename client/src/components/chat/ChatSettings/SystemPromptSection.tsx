import { clsx } from 'clsx';
import { Check, ChevronRight, RotateCcw as Reset } from 'lucide-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeBaseSystemPrompt } from '@/lib/promptBuilder';
import { useAppStore } from '@/stores';
import type { Character, ChatSessionMeta, Scenario } from '@/types';

interface SystemPromptSectionProps {
  session: ChatSessionMeta | null;
  character: Character | null;
  activeScenario: Scenario | null;
  onSettingsChanged?: () => void;
}

export function SystemPromptSection({
  session,
  character,
  activeScenario,
  onSettingsChanged,
}: SystemPromptSectionProps): JSX.Element | null {
  const [expanded, setExpanded] = useState(false);
  const upsertChatSession = useAppStore((s) => s.upsertChatSession);

  const autoPrompt = useMemo(() => {
    if (!character) return '';
    return computeBaseSystemPrompt(character, session?.characterOverrides, activeScenario);
  }, [character, session?.characterOverrides, activeScenario]);

  const hasOverride = !!session?.customSystemPrompt;
  const displayText = hasOverride ? session!.customSystemPrompt! : autoPrompt;

  const [editText, setEditText] = useState(displayText);

  useEffect(() => {
    setEditText(displayText);
  }, [displayText]);

  const isDirty = editText !== displayText;

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleEditChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value);
  }, []);

  const handleSave = useCallback(() => {
    if (!session) return;
    upsertChatSession({ ...session, customSystemPrompt: editText });
    onSettingsChanged?.();
  }, [session, editText, upsertChatSession, onSettingsChanged]);

  const handleReset = useCallback(() => {
    if (!session) return;
    upsertChatSession({ ...session, customSystemPrompt: null });
    setEditText(autoPrompt);
    onSettingsChanged?.();
  }, [session, autoPrompt, upsertChatSession, onSettingsChanged]);

  if (!character) return null;

  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-3">
      <button onClick={handleToggle} className="flex items-center gap-1.5 cursor-pointer group">
        <ChevronRight
          size={12}
          className={clsx('text-[var(--color-primary)] transition-transform duration-200', expanded && 'rotate-90')}
        />
        <span className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide group-hover:text-[var(--color-text)] transition-colors">
          Системный промпт
        </span>
        {hasOverride && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
            Custom
          </span>
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 mt-1">
          <textarea
            value={editText}
            onChange={handleEditChange}
            rows={12}
            className="w-full text-[11px] leading-relaxed bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2.5 py-2 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors resize-y font-mono"
          />
          <div className="text-[9px] text-[var(--color-text-muted)] opacity-60">
            World Info и язык добавляются автоматически
          </div>
          <div className="flex items-center gap-1.5">
            {isDirty && (
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 transition-colors cursor-pointer"
              >
                <Check size={10} />
                Сохранить
              </button>
            )}
            {hasOverride && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-[var(--color-surface-2)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15 transition-colors cursor-pointer"
              >
                <Reset size={10} />
                Сбросить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
