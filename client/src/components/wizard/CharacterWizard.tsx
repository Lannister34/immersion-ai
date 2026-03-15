import { ArrowLeft, ArrowRight, Check, RefreshCw, Sparkles, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createCharacter, generateAvatarPrompt, generateCharacter, regenerateCharacterField } from '@/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { useAppStore } from '@/stores';
import type { GeneratedCharacter } from '@/types';

interface CharacterWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'concept' | 'generating' | 'preview' | 'avatar' | 'saving';

function getStepStyle(i: number, current: number): string {
  if (i < current) return 'bg-[var(--color-accent)] text-white';
  if (i === current) return 'bg-[var(--color-primary)] text-white';
  return 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]';
}

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border)]">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${getStepStyle(i, current)}`}
          >
            {i < current ? <Check size={12} /> : i + 1}
          </div>
          <span
            className={`text-xs whitespace-nowrap ${
              i === current ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
            }`}
          >
            {label}
          </span>
          {i < steps.length - 1 && <div className="w-8 h-px bg-[var(--color-border)] flex-shrink-0" />}
        </div>
      ))}
    </div>
  );
}

const STEP_KEYS = [
  'wizard.stepConcept',
  'wizard.stepGeneration',
  'wizard.stepPreview',
  'wizard.stepAvatar',
  'wizard.stepDone',
] as const;
const STEP_INDEX: Record<Step, number> = {
  concept: 0,
  generating: 1,
  preview: 2,
  avatar: 3,
  saving: 4,
};

export function CharacterWizard({ open, onClose, onComplete }: CharacterWizardProps) {
  const { t } = useTranslation();
  const connection = useAppStore((s) => s.connection);
  const steps = STEP_KEYS.map((key) => t(key));
  const [step, setStep] = useState<Step>('concept');
  const [concept, setConcept] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [character, setCharacter] = useState<GeneratedCharacter | null>(null);
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [avatarNegative, setAvatarNegative] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [regeneratingField, setRegeneratingField] = useState<string | null>(null);
  const [language, setLanguage] = useState<'ru' | 'en'>('ru');

  const resetWizard = () => {
    setStep('concept');
    setConcept('');
    setGenerationError('');
    setCharacter(null);
    setAvatarPrompt('');
    setAvatarNegative('');
    setAvatarFile(null);
    setAvatarPreview(null);
    setIsSaving(false);
    setSaveError('');
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const handleGenerate = async () => {
    if (!concept.trim()) return;
    setGenerationError('');
    setStep('generating');
    try {
      const result = await generateCharacter(concept, language);
      setCharacter(result);
      setStep('preview');
    } catch (err) {
      const msg =
        err instanceof TypeError && err.message === 'Failed to fetch'
          ? t('wizard.connectionError')
          : t('wizard.generationError', { error: err instanceof Error ? err.message : String(err) });
      setGenerationError(msg);
      setStep('concept');
    }
  };

  const handleRegenerateField = async (field: keyof GeneratedCharacter) => {
    if (!character || !connection.connected) return;
    setRegeneratingField(field);
    try {
      const value = await regenerateCharacterField(field, character, concept, language);
      setCharacter((prev) =>
        prev ? { ...prev, [field]: field === 'tags' ? value.split(',').map((t) => t.trim()) : value } : prev,
      );
    } catch {
      // ignore
    } finally {
      setRegeneratingField(null);
    }
  };

  const handleGenerateAvatarPrompt = async () => {
    if (!character || !connection.connected) return;
    setRegeneratingField('avatar');
    try {
      const result = await generateAvatarPrompt(character);
      setAvatarPrompt(result.positive);
      setAvatarNegative(result.negative);
    } catch {
      // ignore
    } finally {
      setRegeneratingField(null);
    }
  };

  const setAvatarFromFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      setAvatarFile(file);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(URL.createObjectURL(file));
    },
    [avatarPreview],
  );

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAvatarFromFile(file);
  };

  const handleRemoveAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer?.types.includes('Files')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setIsDragging(false);
      dragCounter.current = 0;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;
      const file = e.dataTransfer?.files?.[0];
      if (file?.type.startsWith('image/')) setAvatarFromFile(file);
    },
    [setAvatarFromFile],
  );

  // Ctrl+V paste handler (active during avatar step)
  useEffect(() => {
    if (step !== 'avatar') return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            setAvatarFromFile(file);
            break;
          }
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [step, setAvatarFromFile]);

  const handleSave = async () => {
    if (!character) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await createCharacter(character, avatarFile ?? undefined);
      onComplete();
      resetWizard();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof GeneratedCharacter, value: string | string[]) => {
    setCharacter((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  return (
    <Modal open={open} onClose={handleClose} size="xl">
      <StepIndicator current={STEP_INDEX[step]} steps={steps} />

      {/* Step: Concept */}
      {step === 'concept' && (
        <div className="p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">{t('wizard.describeCharacter')}</h3>
            <p className="text-xs text-[var(--color-text-muted)]">{t('wizard.describeHint')}</p>
          </div>
          <Textarea
            placeholder={t('wizard.conceptPlaceholder')}
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            rows={5}
            className="text-sm"
          />
          {generationError && (
            <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-lg p-3">
              {generationError}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-[var(--color-surface-2)] rounded-lg p-0.5">
              <button
                onClick={() => setLanguage('ru')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  language === 'ru'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                RU
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                EN
              </button>
            </div>
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

      {/* Step: Generating */}
      {step === 'generating' && (
        <div className="p-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-[var(--color-text-muted)]">{t('wizard.generatingCharacter')}</div>
          <div className="text-xs text-[var(--color-text-muted)] max-w-xs text-center opacity-60">
            {t('wizard.generatingHint')}
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && character && (
        <div className="p-5 flex flex-col gap-4">
          <PreviewField
            label={t('wizard.nameLabel')}
            field="name"
            value={character.name}
            isText
            onEdit={(v) => updateField('name', v)}
            onRegenerate={() => handleRegenerateField('name')}
            isRegenerating={regeneratingField === 'name'}
            connected={connection.connected}
            regenerateLabel={t('wizard.regenerateField')}
          />
          <PreviewField
            label={t('wizard.descriptionLabel')}
            field="description"
            value={character.description}
            onEdit={(v) => updateField('description', v)}
            onRegenerate={() => handleRegenerateField('description')}
            isRegenerating={regeneratingField === 'description'}
            connected={connection.connected}
            regenerateLabel={t('wizard.regenerateField')}
          />
          <PreviewField
            label={t('wizard.personalityLabel')}
            field="personality"
            value={character.personality}
            onEdit={(v) => updateField('personality', v)}
            onRegenerate={() => handleRegenerateField('personality')}
            isRegenerating={regeneratingField === 'personality'}
            connected={connection.connected}
            regenerateLabel={t('wizard.regenerateField')}
          />
          <PreviewField
            label={t('wizard.mesExampleLabel')}
            field="mes_example"
            value={character.mes_example}
            onEdit={(v) => updateField('mes_example', v)}
            onRegenerate={() => handleRegenerateField('mes_example')}
            isRegenerating={regeneratingField === 'mes_example'}
            rows={6}
            connected={connection.connected}
            regenerateLabel={t('wizard.regenerateField')}
          />

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep('concept')}>
              <ArrowLeft size={15} />
              {t('common.back')}
            </Button>
            <Button onClick={() => setStep('avatar')}>
              {t('wizard.avatarButton')}
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Avatar */}
      {step === 'avatar' && character && (
        <div className="p-5 flex flex-col gap-4">
          <div className="flex gap-4">
            {/* Avatar preview + drop zone */}
            <div
              className={`relative w-32 h-40 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-colors ${
                isDragging
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-2)]'
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {avatarPreview ? (
                <>
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  <button
                    onClick={handleRemoveAvatar}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer"
                    title={t('wizard.removeAvatarTooltip')}
                  >
                    <X size={12} />
                  </button>
                </>
              ) : (
                <img src="/default-avatar.png" alt="Default" className="w-full h-full object-cover opacity-50" />
              )}
              {isDragging && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-primary)]/20 backdrop-blur-sm">
                  <Upload size={24} className="text-[var(--color-primary)]" />
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <p className="text-xs text-[var(--color-text-muted)]">{t('wizard.avatarUploadHint')}</p>

              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
                <div className="rounded-lg font-medium transition-all duration-150 cursor-pointer flex items-center gap-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text)] border border-[var(--color-border)] px-3 py-1.5 text-sm w-full">
                  <Upload size={14} />
                  {t('wizard.uploadImage')}
                </div>
              </label>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateAvatarPrompt}
                loading={regeneratingField === 'avatar'}
                disabled={!connection.connected}
                title={!connection.connected ? t('common.noApiConnection') : undefined}
              >
                <Sparkles size={14} />
                {t('wizard.generateSdPrompt')}
              </Button>
            </div>
          </div>

          {avatarPrompt && (
            <div className="flex flex-col gap-3">
              <Textarea
                label="Positive prompt"
                value={avatarPrompt}
                onChange={(e) => setAvatarPrompt(e.target.value)}
                rows={3}
                className="text-xs font-mono"
              />
              <Textarea
                label="Negative prompt"
                value={avatarNegative}
                onChange={(e) => setAvatarNegative(e.target.value)}
                rows={2}
                className="text-xs font-mono"
              />
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="secondary" onClick={() => setStep('preview')}>
              <ArrowLeft size={15} />
              {t('common.back')}
            </Button>
            <Button onClick={() => setStep('saving')}>
              {t('common.next')}
              <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Save */}
      {step === 'saving' && character && (
        <div className="p-5 flex flex-col gap-4">
          <div className="bg-[var(--color-surface-2)] rounded-xl p-4 flex gap-4">
            <img
              src={avatarPreview ?? '/default-avatar.png'}
              alt="Avatar"
              className={`w-20 h-24 object-cover rounded-lg flex-shrink-0 ${!avatarPreview ? 'opacity-50' : ''}`}
            />
            <div className="flex flex-col gap-1.5">
              <div className="font-semibold text-[var(--color-text)]">{character.name}</div>
              <div className="text-xs text-[var(--color-text-muted)] line-clamp-3">{character.description}</div>
              {character.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {character.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-1.5 py-0.5 rounded-md bg-[var(--color-surface)] text-[var(--color-text-muted)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {saveError && (
            <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-lg p-3">
              {saveError}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep('avatar')}>
              <ArrowLeft size={15} />
              {t('common.back')}
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              <Check size={15} />
              {t('wizard.saveCharacter')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

interface PreviewFieldProps {
  label: string;
  field: string;
  value: string;
  isText?: boolean;
  rows?: number;
  onEdit: (v: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  connected?: boolean;
  regenerateLabel?: string;
}

function PreviewField({
  label,
  value,
  isText = false,
  rows = 4,
  onEdit,
  onRegenerate,
  isRegenerating,
  connected = true,
  regenerateLabel = 'Retry',
}: PreviewFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[var(--color-text-muted)]">{label}</label>
        <button
          onClick={onRegenerate}
          disabled={isRegenerating || !connected}
          className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={11} className={isRegenerating ? 'animate-spin' : ''} />
          {regenerateLabel}
        </button>
      </div>
      {isText ? (
        <input
          value={value}
          onChange={(e) => onEdit(e.target.value)}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors"
        />
      ) : (
        <textarea
          value={value}
          rows={rows}
          onChange={(e) => onEdit(e.target.value)}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors resize-none"
        />
      )}
    </div>
  );
}
