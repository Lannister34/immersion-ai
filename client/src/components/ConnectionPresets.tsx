import { clsx } from 'clsx';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores';
import type { ConnectionPreset } from '@/types';
import { ProviderType } from '@/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

// ── Provider display names ──────────────────────────────────────────────────

const PROVIDER_NAMES: Record<ProviderType, string> = {
  [ProviderType.KoboldCpp]: 'KoboldCpp',
};

// ── Preset edit/create modal ────────────────────────────────────────────────

interface PresetModalProps {
  open: boolean;
  onClose: () => void;
  preset?: ConnectionPreset;
}

function PresetModal({ open, onClose, preset }: PresetModalProps) {
  const { t } = useTranslation();
  const { addConnectionPreset, updateConnectionPreset } = useAppStore();
  const isEdit = !!preset;

  const provider = preset?.provider ?? ProviderType.KoboldCpp;
  const providerName = PROVIDER_NAMES[provider];

  const [url, setUrl] = useState(preset?.url ?? 'http://127.0.0.1:5001');

  const handleSave = useCallback(() => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    if (isEdit && preset) {
      updateConnectionPreset(preset.id, { url: trimmedUrl });
    } else {
      const newPreset: ConnectionPreset = {
        id: `preset-${Date.now()}`,
        name: providerName,
        provider,
        url: trimmedUrl,
      };
      addConnectionPreset(newPreset);
    }
    onClose();
  }, [url, isEdit, preset, provider, providerName, addConnectionPreset, updateConnectionPreset, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? providerName : t('server.newConnection')} size="sm">
      <div className="flex flex-col gap-4 p-5">
        <Input
          label={t('server.presetUrl')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://127.0.0.1:5001"
          autoFocus
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!url.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Delete confirmation modal ───────────────────────────────────────────────

interface DeleteModalProps {
  open: boolean;
  onClose: () => void;
  preset: ConnectionPreset;
}

function DeleteConfirmModal({ open, onClose, preset }: DeleteModalProps) {
  const { t } = useTranslation();
  const { deleteConnectionPreset } = useAppStore();

  const handleDelete = useCallback(() => {
    deleteConnectionPreset(preset.id);
    onClose();
  }, [preset.id, deleteConnectionPreset, onClose]);

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="p-5 flex flex-col gap-4">
        <p className="text-sm text-[var(--color-text)]">{t('server.deletePresetConfirm', { name: preset.name })}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Single preset row ───────────────────────────────────────────────────────

interface PresetRowProps {
  preset: ConnectionPreset;
  isActive: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function PresetRow({ preset, isActive, canDelete, onSelect, onEdit, onDelete }: PresetRowProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
        isActive ? 'bg-[var(--color-surface-2)]' : 'hover:bg-[var(--color-surface-2)]/50',
      )}
      onClick={onSelect}
    >
      <div
        className={clsx(
          'w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
          isActive ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]',
        )}
      >
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-[var(--color-text)] truncate">{preset.name}</div>
        <div className="text-xs text-[var(--color-text-muted)] truncate font-mono">{preset.url}</div>
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 rounded-md hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          <Pencil size={13} />
        </button>
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded-md hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function ConnectionPresets() {
  const { t } = useTranslation();
  const { connectionPresets, activeConnectionPresetId, setActiveConnectionPreset } = useAppStore();

  const [editPreset, setEditPreset] = useState<ConnectionPreset | undefined>();
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletePreset, setDeletePreset] = useState<ConnectionPreset | undefined>();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleAdd = useCallback(() => {
    setEditPreset(undefined);
    setShowEditModal(true);
  }, []);

  const handleEdit = useCallback((preset: ConnectionPreset) => {
    setEditPreset(preset);
    setShowEditModal(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditPreset(undefined);
  }, []);

  const handleRequestDelete = useCallback((preset: ConnectionPreset) => {
    setDeletePreset(preset);
    setShowDeleteModal(true);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
    setDeletePreset(undefined);
  }, []);

  const canDelete = connectionPresets.length > 1;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
        {t('server.connectionTitle')}
      </h3>

      <div className="flex flex-col gap-0.5 bg-[var(--color-background)] rounded-lg p-1.5">
        {connectionPresets.map((preset) => (
          <PresetRow
            key={preset.id}
            preset={preset}
            isActive={preset.id === activeConnectionPresetId}
            canDelete={canDelete}
            onSelect={() => setActiveConnectionPreset(preset.id)}
            onEdit={() => handleEdit(preset)}
            onDelete={() => handleRequestDelete(preset)}
          />
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={handleAdd} className="self-start">
        <Plus size={14} />
        {t('server.addConnection')}
      </Button>

      {showEditModal && <PresetModal open={showEditModal} onClose={handleCloseEditModal} preset={editPreset} />}

      {showDeleteModal && deletePreset && (
        <DeleteConfirmModal open={showDeleteModal} onClose={handleCloseDeleteModal} preset={deletePreset} />
      )}
    </div>
  );
}
