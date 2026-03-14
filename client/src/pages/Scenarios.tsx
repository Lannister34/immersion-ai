import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  FileText,
  Loader2,
  Plus,
  Save,
  Search,
  Sparkles,
  Tag,
  Trash2,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createScenario,
  deleteScenario,
  generateScenario,
  getCharacters,
  getScenario,
  getScenarios,
  getWorldInfo,
  getWorlds,
  saveScenario,
} from '@/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAppStore } from '@/stores';
import type { Scenario } from '@/types';

// ── Scenario Detail (right panel) ───────────────────────────────────────────

function ScenarioDetail({
  name,
  onDeleted,
  onRenamed,
}: {
  name: string;
  onDeleted: () => void;
  onRenamed: (newName: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const connection = useAppStore((s) => s.connection);
  const userName = useAppStore((s) => s.userName);
  const userPersona = useAppStore((s) => s.userPersona);
  const queryClient = useQueryClient();
  const { data: scenario, isLoading } = useQuery({
    queryKey: ['scenario', name],
    queryFn: () => getScenario(name),
  });

  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');
  const [, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [generatingField, setGeneratingField] = useState<'content' | 'tags' | null>(null);
  const [regenError, setRegenError] = useState('');

  // Sync from fetched data
  useEffect(() => {
    if (scenario) {
      setEditName(scenario.name);
      setEditContent(scenario.content);
      setEditTags(scenario.tags.join(', '));
      setDirty(false);
    }
  }, [scenario]);

  const handleSave = async () => {
    if (!scenario || saving) return;
    setSaving(true);
    try {
      const newName = editName.trim() || scenario.name;
      const updated: Scenario = {
        ...scenario,
        name: newName,
        content: editContent,
        tags: editTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      await saveScenario(name, updated);
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      if (newName !== name) {
        // Name changed — update parent selection and invalidate both old and new keys
        queryClient.invalidateQueries({ queryKey: ['scenario', name] });
        queryClient.invalidateQueries({ queryKey: ['scenario', newName] });
        onRenamed(newName);
      } else {
        queryClient.invalidateQueries({ queryKey: ['scenario', name] });
      }
      setDirty(false);
    } catch (err) {
      console.error('Failed to save scenario:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteScenario(name);
      queryClient.invalidateQueries({ queryKey: ['scenarios'] });
      setDeleteOpen(false);
      onDeleted();
    } catch (err) {
      console.error('Failed to delete scenario:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerate = async (field: 'content' | 'tags') => {
    if (generatingField || !scenario) return;
    if (!connection.connected) {
      setRegenError(t('common.noApiConnection'));
      return;
    }
    const concept = scenario.concept || scenario.name;
    setGeneratingField(field);
    setRegenError('');
    try {
      const userCtx = userName ? { name: userName, persona: userPersona || undefined } : undefined;
      const result = await generateScenario(concept, 'ru', undefined, undefined, userCtx);
      if (field === 'content') {
        setEditContent(result.content);
      } else if (field === 'tags') {
        if (result.tags?.length) setEditTags(result.tags.join(', '));
      }
      setDirty(true);
    } catch (err) {
      console.error('Failed to generate scenario:', err);
      setRegenError(String(err));
    } finally {
      setGeneratingField(null);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-[var(--color-text-muted)] p-4">{t('common.loading')}</div>;
  }

  if (!scenario) {
    return <div className="text-sm text-[var(--color-text-muted)] p-4">{t('scenarios.notFound')}</div>;
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FileText size={16} className="text-[var(--color-primary)] flex-shrink-0" />
            <input
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
                setDirty(true);
              }}
              className="text-base font-semibold text-[var(--color-text)] bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-primary)] outline-none transition-colors w-full min-w-0"
              placeholder={t('scenarios.namePlaceholder')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={13} />
              {t('common.delete')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} loading={saving}>
              <Save size={13} />
              {t('common.save')}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              {t('scenarios.contentLabel')}
            </label>
            <button
              onClick={() => handleGenerate('content')}
              disabled={generatingField !== null}
              className="flex items-center gap-1 text-[10px] text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 disabled:opacity-50 transition-colors cursor-pointer"
              title={t('scenarios.generateContentTooltip')}
            >
              {generatingField === 'content' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {generatingField === 'content' ? t('common.generating') : t('common.generate')}
            </button>
          </div>
          <textarea
            value={editContent}
            onChange={(e) => {
              setEditContent(e.target.value);
              setDirty(true);
              setRegenError('');
            }}
            placeholder={t('scenarios.contentPlaceholder')}
            rows={14}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors resize-y leading-relaxed"
          />
          {regenError && <div className="text-xs text-[var(--color-danger)]">{regenError}</div>}
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
              <Tag size={10} />
              {t('scenarios.tagsLabel')}
            </label>
            <button
              onClick={() => handleGenerate('tags')}
              disabled={generatingField !== null}
              className="flex items-center gap-1 text-[10px] text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 disabled:opacity-50 transition-colors cursor-pointer"
              title={t('scenarios.generateTagsTooltip')}
            >
              {generatingField === 'tags' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {generatingField === 'tags' ? t('common.generating') : t('common.generate')}
            </button>
          </div>
          <input
            value={editTags}
            onChange={(e) => {
              setEditTags(e.target.value);
              setDirty(true);
            }}
            placeholder={t('scenarios.tagsPlaceholder')}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
          />
          <div className="text-[9px] text-[var(--color-text-muted)]">{t('common.commaSeparated')}</div>
        </div>

        {/* Meta info */}
        <div className="text-[9px] text-[var(--color-text-muted)] opacity-60 flex gap-4">
          {scenario.createdAt && (
            <span>
              {t('scenarios.createdAt')}{' '}
              {new Date(scenario.createdAt).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')}
            </span>
          )}
          {scenario.updatedAt && (
            <span>
              {t('scenarios.updatedAt')}{' '}
              {new Date(scenario.updatedAt).toLocaleDateString(i18n.language === 'ru' ? 'ru-RU' : 'en-US')}
            </span>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('scenarios.deleteTitle')} size="sm">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-[var(--color-danger)]/15 flex-shrink-0">
              <AlertTriangle size={20} className="text-[var(--color-danger)]" />
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">
              {t('scenarios.deleteConfirm', { name: scenario.name })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
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
    </>
  );
}

// ── Create Scenario Modal ───────────────────────────────────────────────────

function CreateScenarioModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const { t } = useTranslation();
  const connection = useAppStore((s) => s.connection);
  const userName = useAppStore((s) => s.userName);
  const userPersona = useAppStore((s) => s.userPersona);
  const [mode, setMode] = useState<'manual' | 'generate'>('manual');
  const [name, setName] = useState('');
  const [concept, setConcept] = useState('');
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selectedCharAvatar, setSelectedCharAvatar] = useState('');
  const [selectedWorld, setSelectedWorld] = useState('');
  // Generated preview (not yet saved)
  const [preview, setPreview] = useState<{ name: string; content: string; tags: string } | null>(null);

  const { data: characters = [] } = useQuery({
    queryKey: ['characters'],
    queryFn: getCharacters,
    enabled: open && mode === 'generate',
  });

  const { data: worlds = [] } = useQuery({
    queryKey: ['worlds'],
    queryFn: getWorlds,
    enabled: open && mode === 'generate',
  });

  const { data: worldInfo } = useQuery({
    queryKey: ['worldInfo', selectedWorld],
    queryFn: () => getWorldInfo(selectedWorld),
    enabled: !!selectedWorld,
  });

  const reset = () => {
    setMode('manual');
    setName('');
    setConcept('');
    setCreating(false);
    setGenerating(false);
    setError('');
    setSelectedCharAvatar('');
    setSelectedWorld('');
    setPreview(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      await createScenario({ name: name.trim() });
      const created = name.trim();
      reset();
      onCreated(created);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    if (!concept.trim()) return;
    setGenerating(true);
    setError('');
    try {
      // Build optional character context
      const selectedChar = selectedCharAvatar ? characters.find((c) => c.avatar === selectedCharAvatar) : undefined;
      const charContext = selectedChar
        ? { name: selectedChar.name, description: selectedChar.description, personality: selectedChar.personality }
        : undefined;

      // Build optional lorebook entries (comment + keys + content for summarization)
      const loreEntries = worldInfo
        ? Object.values(worldInfo.entries)
            .filter((e) => !e.disable)
            .map((e) => ({ comment: e.comment, keys: e.key, content: e.content }))
        : undefined;

      const userCtx = userName ? { name: userName, persona: userPersona || undefined } : undefined;
      const result = await generateScenario(concept.trim(), 'ru', charContext, loreEntries, userCtx);
      const scenarioName = result.name || concept.trim();
      setPreview({
        name: scenarioName,
        content: result.content,
        tags: result.tags?.join(', ') ?? '',
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    if (!preview) return;
    setCreating(true);
    setError('');
    try {
      const scenarioName = preview.name.trim() || concept.trim();
      await createScenario({
        name: scenarioName,
        content: preview.content,
        tags: preview.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        concept: concept.trim(),
      });
      reset();
      onCreated(scenarioName);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={preview ? t('scenarios.generatedTitle') : t('scenarios.newTitle')}
      size={preview ? 'md' : 'sm'}
    >
      <div className="flex flex-col gap-4 p-5">
        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
          <button
            onClick={() => setMode('manual')}
            className={clsx(
              'flex-1 px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
              mode === 'manual'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            )}
          >
            {t('common.manual')}
          </button>
          <button
            onClick={() => connection.connected && setMode('generate')}
            disabled={!connection.connected}
            className={clsx(
              'flex-1 px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
              !connection.connected
                ? 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] opacity-50 cursor-not-allowed'
                : mode === 'generate'
                  ? 'bg-[var(--color-primary)] text-white cursor-pointer'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer',
            )}
            title={!connection.connected ? t('common.noApiConnection') : undefined}
          >
            <Sparkles size={12} />
            {t('scenarios.generationTab')}
          </button>
        </div>

        {mode === 'manual' ? (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              {t('scenarios.nameLabel')}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('scenarios.manualNamePlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>
        ) : preview ? (
          /* Generated preview — review and edit before saving */
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                {t('scenarios.nameLabel')}
              </label>
              <input
                value={preview.name}
                onChange={(e) => setPreview({ ...preview, name: e.target.value })}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                {t('scenarios.contentPreviewLabel')}
              </label>
              <textarea
                value={preview.content}
                onChange={(e) => setPreview({ ...preview, content: e.target.value })}
                rows={10}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors resize-y leading-relaxed"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
                <Tag size={10} />
                {t('scenarios.tagsLabel')}
              </label>
              <input
                value={preview.tags}
                onChange={(e) => setPreview({ ...preview, tags: e.target.value })}
                placeholder={t('scenarios.tagsPreviewPlaceholder')}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              <div className="text-[9px] text-[var(--color-text-muted)]">{t('common.commaSeparated')}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                {t('scenarios.conceptLabel')}
              </label>
              <textarea
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder={t('scenarios.conceptPlaceholder')}
                rows={4}
                autoFocus
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors resize-y leading-relaxed"
              />
            </div>

            {/* Optional context: character + lorebook */}
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
                  <User size={10} />
                  {t('scenarios.characterLabel')}
                </label>
                <select
                  value={selectedCharAvatar}
                  onChange={(e) => setSelectedCharAvatar(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer"
                >
                  <option value="">{t('common.notSelected')}</option>
                  {characters.map((c) => (
                    <option key={c.avatar} value={c.avatar}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
                  <BookOpen size={10} />
                  {t('scenarios.lorebookLabel')}
                </label>
                <select
                  value={selectedWorld}
                  onChange={(e) => setSelectedWorld(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer"
                >
                  <option value="">{t('common.notSelected')}</option>
                  {worlds.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-[9px] text-[var(--color-text-muted)]">
              {t('scenarios.aiWillGenerate')}
              {(selectedCharAvatar || selectedWorld) && ` ${t('scenarios.contextWillBeUsed')}`}
            </div>
          </div>
        )}

        {error && <div className="text-xs text-[var(--color-danger)]">{error}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button variant="secondary" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          {mode === 'manual' ? (
            <Button onClick={handleCreate} disabled={!name.trim() || creating} loading={creating}>
              <Plus size={14} />
              {t('common.create')}
            </Button>
          ) : preview ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setPreview(null);
                  handleGenerate();
                }}
                disabled={generating}
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {t('common.regenerate')}
              </Button>
              <Button onClick={handleSaveGenerated} disabled={creating} loading={creating}>
                <Save size={14} />
                {t('common.save')}
              </Button>
            </>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={!concept.trim() || generating || !connection.connected}
              title={!connection.connected ? t('common.noApiConnection') : undefined}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? t('common.generating') : t('common.generate')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Scenarios Page ──────────────────────────────────────────────────────────

export function ScenariosPage() {
  const { t } = useTranslation();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: scenarios = [], isLoading } = useQuery({
    queryKey: ['scenarios'],
    queryFn: getScenarios,
  });

  const filtered = search
    ? scenarios.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.content ?? '').toLowerCase().includes(search.toLowerCase()) ||
          s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
      )
    : scenarios;

  const handleCreated = (name: string) => {
    queryClient.invalidateQueries({ queryKey: ['scenarios'] });
    setSelectedScenario(name);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
      {/* Sidebar list */}
      <div
        className={clsx(
          'flex-shrink-0 flex flex-col gap-3',
          selectedScenario ? 'hidden sm:flex sm:w-56' : 'w-full sm:w-56',
        )}
      >
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus size={14} />
          {t('common.create')}
        </Button>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>

        {isLoading ? (
          <div className="text-sm text-[var(--color-text-muted)]">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-[var(--color-text-muted)]">
            {scenarios.length === 0 ? t('scenarios.empty') : t('common.nothingFound')}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map((s) => (
              <button
                key={s.name}
                onClick={() => setSelectedScenario(s.name)}
                className={clsx(
                  'flex flex-col gap-0.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer',
                  selectedScenario === s.name
                    ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
                )}
              >
                <div className="flex items-center gap-2">
                  <FileText size={13} className="flex-shrink-0" />
                  <span className="text-sm truncate flex-1">{s.name}</span>
                </div>
                {s.content && (
                  <span className="text-[10px] opacity-60 truncate pl-[21px]">{s.content.slice(0, 100)}</span>
                )}
                {s.tags.length > 0 && (
                  <div className="flex gap-1 pl-[21px] flex-wrap">
                    {s.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[8px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {selectedScenario ? (
          <div className="flex flex-col gap-3">
            {/* Back button on mobile */}
            <button
              onClick={() => setSelectedScenario(null)}
              className="sm:hidden flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              {t('scenarios.backToList')}
            </button>
            <ScenarioDetail
              name={selectedScenario}
              onDeleted={() => setSelectedScenario(null)}
              onRenamed={(newName) => setSelectedScenario(newName)}
            />
          </div>
        ) : (
          <div className="hidden sm:flex items-center justify-center h-full">
            <div className="text-center text-[var(--color-text-muted)]">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm">{t('scenarios.emptyState')}</div>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      <CreateScenarioModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </div>
  );
}
