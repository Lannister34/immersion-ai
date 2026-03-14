import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  Key,
  Plus,
  Save,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteWorldInfo, generateLorebook, getWorldInfo, getWorlds, saveWorldInfo } from '@/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useAppStore } from '@/stores';
import type { GeneratedLorebook, WorldInfo, WorldInfoEntry } from '@/types';

// ── Lorebook Wizard ────────────────────────────────────────────────────────────

interface LorebookWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type WizardStep = 'concept' | 'generating' | 'preview' | 'name' | 'saving';

function LorebookWizard({ open, onClose, onComplete }: LorebookWizardProps) {
  const { t } = useTranslation();
  const connection = useAppStore((s) => s.connection);
  const [step, setStep] = useState<WizardStep>('concept');
  const [concept, setConcept] = useState('');
  const [entryCount, setEntryCount] = useState(8);
  const [generated, setGenerated] = useState<GeneratedLorebook | null>(null);
  const [lorebookName, setLorebookName] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setStep('concept');
    setConcept('');
    setEntryCount(8);
    setGenerated(null);
    setLorebookName('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleGenerate = async () => {
    if (!concept.trim()) return;
    setError('');
    setStep('generating');
    try {
      const result = await generateLorebook(concept, entryCount, useAppStore.getState().responseLanguage);
      setGenerated(result);
      setLorebookName(
        concept
          .slice(0, 30)
          .replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '')
          .trim() || t('lorebooks.defaultName'),
      );
      setStep('preview');
    } catch (err) {
      setError(String(err));
      setStep('concept');
    }
  };

  const handleSave = async () => {
    if (!generated || !lorebookName.trim()) return;
    setIsSaving(true);
    setError('');
    try {
      const entries: Record<string, WorldInfoEntry> = {};
      generated.entries.forEach((e, i) => {
        entries[String(i)] = {
          uid: i,
          key: e.key,
          keysecondary: [],
          comment: e.comment,
          content: e.content,
          constant: false,
          selective: true,
          order: 100,
          position: 0,
          disable: false,
          displayIndex: i,
          addMemo: true,
          group: '',
          groupOverride: false,
          groupWeight: 100,
          sticky: 0,
          cooldown: 0,
          delay: 0,
          probability: 100,
          depth: 4,
          useProbability: true,
          role: null,
        };
      });
      const worldData: WorldInfo = { name: lorebookName, entries };
      await saveWorldInfo(lorebookName, worldData);
      onComplete();
      reset();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const updateEntry = (index: number, field: 'key' | 'comment' | 'content', value: string | string[]) => {
    setGenerated((prev) => {
      if (!prev) return prev;
      const entries = [...prev.entries];
      entries[index] = { ...entries[index], [field]: value };
      return { ...prev, entries };
    });
  };

  const STEPS = [
    t('lorebooks.stepConcept'),
    t('lorebooks.stepGeneration'),
    t('lorebooks.stepPreview'),
    t('lorebooks.stepName'),
    t('lorebooks.stepDone'),
  ];
  const stepIdx = { concept: 0, generating: 1, preview: 2, name: 3, saving: 4 }[step];

  return (
    <Modal open={open} onClose={handleClose} size="xl" title="">
      {/* Step indicators */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border)]">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                i < stepIdx
                  ? 'bg-[var(--color-accent)] text-white'
                  : i === stepIdx
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
              }`}
            >
              {i < stepIdx ? <Check size={12} /> : i + 1}
            </div>
            <span
              className={`text-xs whitespace-nowrap ${i === stepIdx ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-[var(--color-border)] flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Concept step */}
      {step === 'concept' && (
        <div className="p-5 flex flex-col gap-4">
          <Textarea
            label={t('lorebooks.worldConceptLabel')}
            placeholder={t('lorebooks.worldConceptPlaceholder')}
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            rows={4}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[var(--color-text-muted)] font-medium">
              {t('lorebooks.entryCountLabel', { count: entryCount })}
            </label>
            <input
              type="range"
              min={3}
              max={20}
              value={entryCount}
              onChange={(e) => setEntryCount(Number(e.target.value))}
              className="w-full accent-[var(--color-primary)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
              <span>3</span>
              <span>20</span>
            </div>
          </div>
          {error && (
            <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-lg p-3">{error}</div>
          )}
          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={!concept.trim() || !connection.connected}
              title={!connection.connected ? t('common.noApiConnection') : undefined}
            >
              <Sparkles size={15} />
              {t('common.generate')}
            </Button>
          </div>
        </div>
      )}

      {/* Generating step */}
      {step === 'generating' && (
        <div className="p-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-[var(--color-text-muted)]">{t('lorebooks.generating')}</div>
        </div>
      )}

      {/* Preview step */}
      {step === 'preview' && generated && (
        <div className="p-5 flex flex-col gap-4">
          <div className="text-xs text-[var(--color-text-muted)]">
            {t('lorebooks.previewHint', { count: generated.entries.length })}
          </div>
          <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
            {generated.entries.map((entry, i) => (
              <div key={i} className="bg-[var(--color-surface-2)] rounded-xl p-3 flex flex-col gap-2">
                <div className="text-xs font-semibold text-[var(--color-text)]">{entry.comment}</div>
                <div className="flex gap-1 flex-wrap">
                  {entry.key.map((k, ki) => (
                    <span
                      key={ki}
                      className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-muted)]"
                    >
                      {k}
                    </span>
                  ))}
                </div>
                <textarea
                  value={entry.content}
                  rows={3}
                  onChange={(e) => updateEntry(i, 'content', e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors resize-none"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('concept')}>
              <ArrowLeft size={15} />
              {t('common.back')}
            </Button>
            <Button onClick={() => setStep('name')}>
              {t('common.next')}
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {/* Name step */}
      {step === 'name' && (
        <div className="p-5 flex flex-col gap-4">
          <Input
            label={t('lorebooks.nameLabel')}
            value={lorebookName}
            onChange={(e) => setLorebookName(e.target.value)}
            placeholder={t('lorebooks.namePlaceholder')}
          />
          {error && (
            <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-lg p-3">{error}</div>
          )}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('preview')}>
              <ArrowLeft size={15} />
              {t('common.back')}
            </Button>
            <Button onClick={handleSave} loading={isSaving} disabled={!lorebookName.trim()}>
              <Check size={15} />
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Lorebook Entry Item ─────────────────────────────────────────────────────────

function EntryItem({
  entry,
  onToggle,
  onSave,
}: {
  entry: WorldInfoEntry;
  onToggle?: (uid: number, disabled: boolean) => void;
  onSave?: (uid: number, updates: Partial<WorldInfoEntry>) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editKeys, setEditKeys] = useState('');
  const [editComment, setEditComment] = useState('');
  const keyCount = entry.key.length;
  const contentPreview = entry.content.slice(0, 80) + (entry.content.length > 80 ? '...' : '');

  const startEdit = () => {
    setEditContent(entry.content);
    setEditKeys(entry.key.join(', '));
    setEditComment(entry.comment);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = () => {
    if (!onSave) return;
    const newKeys = editKeys
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    onSave(entry.uid, {
      content: editContent,
      key: newKeys,
      comment: editComment,
    });
    setEditing(false);
  };

  return (
    <div
      className={clsx(
        'bg-[var(--color-surface-2)] rounded-xl overflow-hidden transition-opacity',
        entry.disable && 'opacity-50',
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left cursor-pointer hover:bg-[var(--color-border)]/30 transition-colors"
      >
        <div className="flex-shrink-0 text-[var(--color-text-muted)]">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-text)] truncate">
              {entry.comment || t('lorebooks.untitled')}
            </span>
            {entry.constant && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)] flex-shrink-0">
                const
              </span>
            )}
          </div>
          {!expanded && <div className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">{contentPreview}</div>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <Key size={10} />
            {keyCount}
          </div>
          {onToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(entry.uid, !entry.disable);
              }}
              className={clsx(
                'p-1 rounded transition-colors cursor-pointer',
                entry.disable
                  ? 'text-[var(--color-text-muted)] hover:text-[var(--color-accent)]'
                  : 'text-[var(--color-accent)] hover:text-[var(--color-text-muted)]',
              )}
              title={entry.disable ? t('lorebooks.enable') : t('lorebooks.disable')}
            >
              {entry.disable ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
            </button>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {editing ? (
            <>
              {/* Edit mode */}
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
                  {t('lorebooks.entryNameLabel')}
                </label>
                <input
                  type="text"
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
                  {t('lorebooks.keysLabel')}
                </label>
                <input
                  type="text"
                  value={editKeys}
                  onChange={(e) => setEditKeys(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 block">
                  {t('lorebooks.contentLabel')}
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={5}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary)]/80 transition-colors cursor-pointer"
                >
                  <Save size={12} />
                  {t('common.save')}
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                >
                  <X size={12} />
                  {t('common.cancel')}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* View mode */}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {entry.key.map((k, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                    >
                      {k}
                    </span>
                  ))}
                  {entry.keysecondary.length > 0 && (
                    <>
                      <span className="text-xs text-[var(--color-text-muted)] self-center px-1">+</span>
                      {entry.keysecondary.map((k, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                        >
                          {k}
                        </span>
                      ))}
                    </>
                  )}
                </div>
                {onSave && (
                  <button
                    onClick={startEdit}
                    className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer flex-shrink-0"
                    title={t('lorebooks.editTooltip')}
                  >
                    <Edit3 size={13} />
                  </button>
                )}
              </div>
              {/* Content */}
              <div className="text-sm text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                {entry.content}
              </div>
              {/* Meta */}
              <div className="flex flex-wrap gap-3 text-[10px] text-[var(--color-text-muted)]/60">
                <span>Order: {entry.order}</span>
                <span>Depth: {entry.depth}</span>
                <span>Prob: {entry.probability}%</span>
                {entry.selective && <span>Selective</span>}
                {entry.group && <span>Group: {entry.group}</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Lorebook Detail Panel ───────────────────────────────────────────────────────

function LorebookDetail({ name }: { name: string }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['worldinfo', name],
    queryFn: () => getWorldInfo(name),
  });

  const entries = useMemo(() => {
    if (!data?.entries) return [];
    return Object.values(data.entries).sort((a, b) => (a.displayIndex ?? 0) - (b.displayIndex ?? 0));
  }, [data]);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.comment?.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.key.some((k) => k.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  const activeCount = entries.filter((e) => !e.disable).length;

  const handleToggle = async (uid: number, disabled: boolean) => {
    if (!data) return;
    const updated = { ...data };
    const entryKey = Object.keys(updated.entries).find((k) => updated.entries[k].uid === uid);
    if (entryKey) {
      updated.entries[entryKey] = { ...updated.entries[entryKey], disable: disabled };
      try {
        await saveWorldInfo(name, updated);
        queryClient.invalidateQueries({ queryKey: ['worldinfo', name] });
      } catch (err) {
        console.error('Failed to toggle entry:', err);
      }
    }
  };

  const handleSaveEntry = async (uid: number, updates: Partial<WorldInfoEntry>) => {
    if (!data) return;
    const updated = { ...data, entries: { ...data.entries } };
    const entryKey = Object.keys(updated.entries).find((k) => updated.entries[k].uid === uid);
    if (entryKey) {
      updated.entries[entryKey] = { ...updated.entries[entryKey], ...updates };
      try {
        await saveWorldInfo(name, updated);
        queryClient.invalidateQueries({ queryKey: ['worldinfo', name] });
      } catch (err) {
        console.error('Failed to save entry:', err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex-1 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder={t('lorebooks.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>
        <div className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
          {t('lorebooks.activeCount', { active: activeCount, total: entries.length })}
        </div>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)] text-center py-8">
            {search ? t('lorebooks.searchEmpty') : t('lorebooks.noEntries')}
          </div>
        ) : (
          filtered.map((entry) => (
            <EntryItem key={entry.uid} entry={entry} onToggle={handleToggle} onSave={handleSaveEntry} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────

export function LorebooksPage() {
  const { t } = useTranslation();
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const { data: worlds = [], isLoading } = useQuery({
    queryKey: ['worlds'],
    queryFn: getWorlds,
  });

  const handleWizardComplete = () => {
    setWizardOpen(false);
    queryClient.invalidateQueries({ queryKey: ['worlds'] });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteWorldInfo(deleteTarget);
      if (selectedWorld === deleteTarget) setSelectedWorld(null);
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete lorebook:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
      {/* Sidebar list */}
      <div
        className={clsx(
          'flex-shrink-0 flex flex-col gap-3',
          // On mobile: show as horizontal scroll or compact list when no world selected
          selectedWorld ? 'hidden sm:flex sm:w-56' : 'w-full sm:w-56',
        )}
      >
        <Button onClick={() => setWizardOpen(true)} size="sm">
          <Plus size={14} />
          {t('common.create')}
        </Button>

        {isLoading ? (
          <div className="text-sm text-[var(--color-text-muted)]">{t('common.loading')}</div>
        ) : worlds.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)]">{t('lorebooks.empty')}</div>
        ) : (
          <div className="flex flex-col gap-1">
            {worlds.map((name) => (
              <div
                key={name}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors group/lb',
                  selectedWorld === name
                    ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
                )}
              >
                <button
                  onClick={() => setSelectedWorld(name)}
                  className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer text-left"
                >
                  <BookOpen size={14} className="flex-shrink-0" />
                  <span className="truncate flex-1">{name}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(name);
                  }}
                  className="opacity-0 group-hover/lb:opacity-100 p-1 rounded hover:bg-[var(--color-danger)]/20 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all cursor-pointer flex-shrink-0"
                  title={t('lorebooks.deleteTooltip')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {selectedWorld ? (
          <div className="flex flex-col gap-3">
            {/* Back button on mobile */}
            <button
              onClick={() => setSelectedWorld(null)}
              className="sm:hidden flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              {t('lorebooks.backToList')}
            </button>
            <LorebookDetail name={selectedWorld} />
          </div>
        ) : (
          <div className="hidden sm:flex items-center justify-center h-full">
            <div className="text-center text-[var(--color-text-muted)]">
              <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm">{t('lorebooks.emptyState')}</div>
            </div>
          </div>
        )}
      </div>

      <LorebookWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onComplete={handleWizardComplete} />

      {/* Delete confirmation modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('lorebooks.deleteTitle')} size="sm">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-[var(--color-danger)]/15 flex-shrink-0">
              <AlertTriangle size={20} className="text-[var(--color-danger)]" />
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">
              {t('lorebooks.deleteConfirm', { name: deleteTarget })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
