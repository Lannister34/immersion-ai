import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  History,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  MessageSquareDashed,
  Pencil,
  Plus,
  Save,
  Search,
  SortAsc,
  SortDesc,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ChatFileInfo } from '@/api';
import {
  createCharacter,
  createNewChat,
  deleteCharacter,
  editCharacter,
  generateFirstMessage,
  getCharacterChats,
  getCharacters,
  getScenario,
  getScenarios,
  getWorlds,
} from '@/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CharacterWizard } from '@/components/wizard/CharacterWizard';
import { hideOnImageError } from '@/lib/imageUtils';
import { useAppStore } from '@/stores';
import type { Character } from '@/types';

type SortField = 'name' | 'tags';
type SortDir = 'asc' | 'desc';

/** Sentinel avatar value for chats without a character */
const NO_CHARACTER_AVATAR = '_no_character_';

function CharacterCard({
  character,
  chatCount,
  avatarVersion,
  onStartChat,
  onViewDetails,
}: {
  character: Character;
  chatCount?: number;
  avatarVersion?: number;
  onStartChat: (c: Character) => void;
  onViewDetails: (c: Character) => void;
}) {
  const { t } = useTranslation();
  const avatarUrl = character.avatar
    ? `/characters/${character.avatar}${avatarVersion ? `?v=${avatarVersion}` : ''}`
    : null;

  return (
    <div
      onClick={() => onViewDetails(character)}
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden hover:border-[var(--color-primary)]/50 transition-colors group cursor-pointer relative"
    >
      {/* Avatar */}
      <div className="aspect-[3/4] bg-[var(--color-surface-2)] relative overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt={character.name} className="w-full h-full object-cover" onError={hideOnImageError} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User size={48} className="text-[var(--color-border)]" />
          </div>
        )}
        {/* Chat count badge */}
        {chatCount !== undefined && chatCount > 0 && (
          <div className="absolute top-2 right-2 z-[5] flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5">
            <MessageCircle size={10} className="text-[var(--color-primary)]" />
            <span className="text-[10px] font-semibold text-white">{chatCount}</span>
          </div>
        )}
        {/* Quick chat button on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartChat(character);
          }}
          className="absolute bottom-2 right-2 z-[5] bg-[var(--color-primary)] rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--color-primary)]/80 shadow-lg cursor-pointer"
          title={t('characters.startChat')}
        >
          <MessageCircle size={14} className="text-white" />
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="font-medium text-sm text-[var(--color-text)] truncate">{character.name}</div>
        {character.description && (
          <div className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">{character.description}</div>
        )}
        {character.tags && character.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {character.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded-md bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              >
                {tag}
              </span>
            ))}
            {character.tags.length > 3 && (
              <span className="text-xs px-1.5 py-0.5 text-[var(--color-text-muted)]">+{character.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CharacterListItem({
  character,
  chatCount,
  avatarVersion,
  onStartChat,
  onViewDetails,
}: {
  character: Character;
  chatCount?: number;
  avatarVersion?: number;
  onStartChat: (c: Character) => void;
  onViewDetails: (c: Character) => void;
}) {
  const { t } = useTranslation();
  const avatarUrl = character.avatar
    ? `/characters/${character.avatar}${avatarVersion ? `?v=${avatarVersion}` : ''}`
    : null;
  const initials = character.name
    ? character.name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  return (
    <div
      onClick={() => onViewDetails(character)}
      className="flex items-center gap-3 px-3 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)]/50 transition-colors group cursor-pointer"
    >
      {/* Avatar thumbnail */}
      <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] flex-shrink-0 overflow-hidden flex items-center justify-center">
        {avatarUrl ? (
          <img src={avatarUrl} alt={character.name} className="w-full h-full object-cover" onError={hideOnImageError} />
        ) : (
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">{initials}</span>
        )}
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-[var(--color-text)] truncate">{character.name}</div>
        {character.description && (
          <div className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">{character.description}</div>
        )}
      </div>

      {/* Tags (compact) */}
      {character.tags && character.tags.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
          {character.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
            >
              {tag}
            </span>
          ))}
          {character.tags.length > 2 && (
            <span className="text-[10px] text-[var(--color-text-muted)]">+{character.tags.length - 2}</span>
          )}
        </div>
      )}

      {/* Chat count + action */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {chatCount !== undefined && chatCount > 0 && (
          <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
            <MessageCircle size={12} className="text-[var(--color-primary)]" />
            <span className="text-[10px]">{chatCount}</span>
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartChat(character);
          }}
          className="p-1.5 rounded-full bg-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--color-primary)]/80 cursor-pointer"
          title={t('characters.startChat')}
        >
          <MessageCircle size={12} className="text-white" />
        </button>
        <ChevronRight size={14} className="text-[var(--color-text-muted)] opacity-40" />
      </div>
    </div>
  );
}

function formatChatDate(chatId: string, locale: string): string {
  try {
    // Try numeric timestamp first (e.g. "1738000000000")
    const ts = parseInt(chatId, 10);
    if (!Number.isNaN(ts) && String(ts) === chatId) {
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      }
    }

    // Try ST format: "Name - 2026-02-26@00h58m27s265ms"
    const dateMatch = chatId.match(/(\d{4}-\d{2}-\d{2})@(\d{2})h(\d{2})m(\d{2})s/);
    if (dateMatch) {
      const [, date, h, m, s] = dateMatch;
      const d = new Date(`${date}T${h}:${m}:${s}`);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      }
    }

    // Fallback: just strip the character name prefix if present
    const stripped = chatId.replace(/^.+? - /, '');
    return stripped || chatId;
  } catch {
    return chatId;
  }
}

// ── Editable field component ─────────────────────────────────────────────────

function EditField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wide">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors resize-y min-h-[80px]"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
        />
      )}
    </div>
  );
}

// ── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  characterName,
  isDeleting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  characterName: string;
  isDeleting: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={t('characters.deleteTitle')} size="sm">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-[var(--color-danger)]/15 flex-shrink-0">
            <AlertTriangle size={20} className="text-[var(--color-danger)]" />
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {t('characters.deleteConfirm', { characterName })}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isDeleting}>
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
  );
}

// ── Character Detail Modal ───────────────────────────────────────────────────

function CharacterDetailModal({
  character,
  open,
  onClose,
  onStartChat,
  onOpenChat,
  onCharacterUpdated,
  onCharacterDeleted,
  avatarVersion,
}: {
  character: Character | null;
  open: boolean;
  onClose: () => void;
  onStartChat: (c: Character) => void;
  onOpenChat: (avatar: string, chatFile: string) => void;
  onCharacterUpdated: () => void;
  onCharacterDeleted: () => void;
  avatarVersion?: number;
}) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<'info' | 'edit' | 'chats'>('info');
  const [chats, setChats] = useState<ChatFileInfo[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  // Edit state
  const [editData, setEditData] = useState<Partial<Character>>({});
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Delete state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Available lorebooks
  const { data: worlds = [] } = useQuery({
    queryKey: ['worlds'],
    queryFn: getWorlds,
    enabled: open,
  });

  useEffect(() => {
    if (!character?.avatar || !open) return;
    setTab('info');
    setChats([]);
    setSaveError('');
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
    // Initialize edit data from character
    setEditData({
      name: character.name,
      description: character.description,
      personality: character.personality,
      mes_example: character.mes_example,
      tags: character.tags,
      world: character.world ?? '',
    });
  }, [character, open]);

  const loadChats = async () => {
    if (!character?.avatar) return;
    setLoadingChats(true);
    try {
      const result = await getCharacterChats(character.avatar);
      setChats(result);
    } catch {
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  };

  const handleTabClick = (t: 'info' | 'edit' | 'chats') => {
    setTab(t);
    if (t === 'chats' && chats.length === 0) {
      loadChats();
    }
  };

  const handleSave = async () => {
    if (!character?.avatar) return;
    setSaving(true);
    setSaveError('');
    try {
      await editCharacter(character.avatar, editData, editAvatarFile ?? undefined);
      onCharacterUpdated();
      setTab('info');
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!character?.avatar) return;
    setIsDeleting(true);
    try {
      await deleteCharacter(character.avatar, true);
      setDeleteModalOpen(false);
      onClose();
      onCharacterDeleted();
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const updateEditField = (field: keyof Character, value: string) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  if (!character) return null;

  const avatarUrl = character.avatar
    ? `/characters/${character.avatar}${avatarVersion ? `?v=${avatarVersion}` : ''}`
    : null;

  return (
    <>
      <Modal open={open} onClose={onClose} title={character.name} size="lg">
        <div className="flex flex-col gap-0">
          {/* Tabs */}
          <div className="flex border-b border-[var(--color-border)] px-5">
            {[
              { id: 'info' as const, label: t('characters.tabInfo'), icon: null },
              { id: 'edit' as const, label: t('characters.tabEdit'), icon: <Pencil size={12} /> },
              { id: 'chats' as const, label: t('characters.tabChatHistory'), icon: <History size={12} /> },
            ].map((tabItem) => (
              <button
                key={tabItem.id}
                onClick={() => handleTabClick(tabItem.id)}
                className={clsx(
                  'px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer relative flex items-center gap-1.5',
                  tab === tabItem.id
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                )}
              >
                {tabItem.icon}
                {tabItem.label}
                {tab === tabItem.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
                )}
              </button>
            ))}
          </div>

          {tab === 'info' ? (
            <div className="flex flex-col gap-5 p-5">
              {/* Top section: avatar + basic info */}
              <div className="flex gap-5">
                {avatarUrl && (
                  <div className="w-32 h-40 rounded-xl overflow-hidden flex-shrink-0 border border-[var(--color-border)]">
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 flex flex-col gap-2">
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">{character.name}</h2>
                  {character.tags && character.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {character.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {character.personality && (
                    <div className="text-xs text-[var(--color-text-muted)]">
                      <span className="font-semibold text-[var(--color-text)]">{t('characters.personalityLabel')}</span>
                      {character.personality}
                    </div>
                  )}
                  {character.world && (
                    <div className="text-xs text-[var(--color-text-muted)]">
                      <span className="font-semibold text-[var(--color-text)]">{t('characters.lorebookLabel')}</span>
                      {character.world}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {character.description && (
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text)] mb-1.5 uppercase tracking-wide">
                    {t('characters.descriptionLabel')}
                  </h3>
                  <div className="text-sm text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {character.description}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
                <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                  <Trash2 size={14} />
                  {t('common.delete')}
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={onClose}>
                    {t('common.close')}
                  </Button>
                  <Button
                    onClick={() => {
                      onStartChat(character);
                      onClose();
                    }}
                  >
                    <MessageCircle size={14} />
                    {t('characters.startChat')}
                  </Button>
                </div>
              </div>
            </div>
          ) : tab === 'edit' ? (
            <div className="flex flex-col max-h-[70vh]">
              <div className="flex flex-col gap-4 p-5 overflow-y-auto flex-1 min-h-0">
                {/* Avatar upload */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {editAvatarPreview ? (
                      <img src={editAvatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} className="text-[var(--color-text-muted)]" />
                    )}
                  </div>
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer">
                    <Upload size={14} />
                    {t('characters.changeAvatar')}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setEditAvatarFile(file);
                        setEditAvatarPreview(URL.createObjectURL(file));
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <EditField
                  label={t('characters.nameLabel')}
                  value={editData.name ?? ''}
                  onChange={(v) => updateEditField('name', v)}
                  placeholder={t('characters.namePlaceholder')}
                />
                <EditField
                  label={t('characters.descriptionLabel')}
                  value={editData.description ?? ''}
                  onChange={(v) => updateEditField('description', v)}
                  multiline
                  placeholder={t('characters.descriptionPlaceholder')}
                />
                <EditField
                  label={t('characters.personalityField')}
                  value={editData.personality ?? ''}
                  onChange={(v) => updateEditField('personality', v)}
                  multiline
                  placeholder={t('characters.personalityPlaceholder')}
                />
                <EditField
                  label={t('characters.mesExampleLabel')}
                  value={editData.mes_example ?? ''}
                  onChange={(v) => updateEditField('mes_example', v)}
                  multiline
                  placeholder="<START>\n{{user}}: Привет!\n{{char}}: ..."
                />
                <EditField
                  label={t('characters.tagsLabel')}
                  value={(editData.tags ?? []).join(', ')}
                  onChange={(v) =>
                    setEditData((prev) => ({
                      ...prev,
                      tags: v
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder={t('characters.tagsPlaceholder')}
                />

                {/* Lorebook selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wide flex items-center gap-1.5">
                    <BookOpen size={12} />
                    {t('characters.lorebook')}
                  </label>
                  <select
                    value={editData.world ?? ''}
                    onChange={(e) => setEditData((prev) => ({ ...prev, world: e.target.value }))}
                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer"
                  >
                    <option value="">{t('characters.noLorebook')}</option>
                    {worlds.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>

                {saveError && (
                  <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-lg p-3">
                    {saveError}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 p-4 border-t border-[var(--color-border)] bg-[var(--color-background)] flex-shrink-0">
                <Button variant="secondary" onClick={() => setTab('info')}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {t('common.save')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-5">
              {loadingChats ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : chats.length === 0 ? (
                <div className="text-center text-[var(--color-text-muted)] py-8 text-sm">
                  {t('characters.noSavedChats')}
                </div>
              ) : (
                <>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {t('characters.chatCount', { count: chats.length })}
                  </div>
                  <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                    {chats.map((chat) => (
                      <button
                        key={chat.file_name}
                        onClick={() => {
                          if (character.avatar) {
                            onOpenChat(character.avatar, chat.file_name);
                            onClose();
                          }
                        }}
                        className="flex items-start gap-3 p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer text-left w-full"
                      >
                        <Clock size={14} className="text-[var(--color-text-muted)] flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[var(--color-text)]">
                              {formatChatDate(chat.file_name, i18n.language === 'ru' ? 'ru-RU' : 'en-US')}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                              {chat.chat_items} {t('characters.messagesShort')}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">{chat.file_size}</span>
                          </div>
                          {chat.mes && (
                            <div className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                              {chat.mes.slice(0, 150)}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
                <Button variant="secondary" onClick={onClose}>
                  {t('common.close')}
                </Button>
                <Button
                  onClick={() => {
                    onStartChat(character);
                    onClose();
                  }}
                >
                  <Plus size={14} />
                  {t('characters.newChat')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete confirmation */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        characterName={character.name}
        isDeleting={isDeleting}
      />
    </>
  );
}

// ── Manual Character Creation Modal ──────────────────────────────────────────

function ManualCharacterModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    description: '',
    personality: '',
    mes_example: '',
    system_prompt: '',
    tags: '',
    world: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Available lorebooks
  const { data: worlds = [] } = useQuery({
    queryKey: ['worlds'],
    queryFn: getWorlds,
    enabled: open,
  });

  const reset = () => {
    setForm({ name: '', description: '', personality: '', mes_example: '', system_prompt: '', tags: '', world: '' });
    setAvatarFile(null);
    setAvatarPreview(null);
    setSaving(false);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError(t('characters.nameRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createCharacter(
        {
          name: form.name.trim(),
          description: form.description,
          personality: form.personality,
          mes_example: form.mes_example,
          system_prompt: form.system_prompt,
          tags: form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          world: form.world || undefined,
        },
        avatarFile ?? undefined,
      );
      onComplete();
      reset();
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Modal open={open} onClose={handleClose} size="xl">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)]">
        <FileText size={18} className="text-[var(--color-primary)]" />
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('characters.createTitle')}</h2>
      </div>

      <div className="flex flex-col max-h-[70vh]">
        <div className="flex flex-col gap-4 p-5 overflow-y-auto flex-1 min-h-0">
          {/* Avatar upload */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden flex-shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={24} className="text-[var(--color-text-muted)]" />
              )}
            </div>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer">
              <Upload size={14} />
              {t('characters.uploadAvatar')}
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>

          <EditField
            label={t('characters.nameLabel')}
            value={form.name}
            onChange={(v) => updateField('name', v)}
            placeholder={t('characters.namePlaceholder')}
          />
          <EditField
            label={t('characters.descriptionLabel')}
            value={form.description}
            onChange={(v) => updateField('description', v)}
            multiline
            placeholder={t('characters.descriptionPlaceholder')}
          />
          <EditField
            label={t('characters.personalityField')}
            value={form.personality}
            onChange={(v) => updateField('personality', v)}
            multiline
            placeholder={t('characters.personalityPlaceholder')}
          />
          <EditField
            label={t('characters.mesExampleLabel')}
            value={form.mes_example}
            onChange={(v) => updateField('mes_example', v)}
            multiline
            placeholder="<START>\n{{user}}: Привет!\n{{char}}: ..."
          />
          <EditField
            label={t('characters.systemPromptLabel')}
            value={form.system_prompt}
            onChange={(v) => updateField('system_prompt', v)}
            multiline
            placeholder={t('characters.systemPromptPlaceholder')}
          />
          <EditField
            label={t('characters.tagsLabel')}
            value={form.tags}
            onChange={(v) => updateField('tags', v)}
            placeholder={t('characters.tagsPlaceholder')}
          />

          {/* Lorebook selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wide flex items-center gap-1.5">
              <BookOpen size={12} />
              {t('characters.lorebook')}
            </label>
            <select
              value={form.world}
              onChange={(e) => updateField('world', e.target.value)}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer"
            >
              <option value="">{t('characters.noLorebook')}</option>
              {worlds.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-xs text-[var(--color-danger)] bg-[var(--color-danger)]/10 rounded-lg p-3">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-[var(--color-border)] bg-[var(--color-background)] flex-shrink-0">
          <Button variant="secondary" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {t('common.create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Start Chat Modal ─────────────────────────────────────────────────────────

function ClearableField({
  label,
  value,
  onChange,
  placeholder,
  clearLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  clearLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wide">{label}</label>
        {value && (
          <button
            onClick={() => onChange('')}
            className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
            title={clearLabel}
          >
            <X size={10} />
            {clearLabel}
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors resize-y min-h-[60px]"
      />
    </div>
  );
}

interface StartChatOverrides {
  description: string;
  personality: string;
  first_mes: string;
  activeScenarioName?: string;
}

function StartChatModal({
  character,
  open,
  onClose,
  onConfirm,
}: {
  character: Character | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (overrides: StartChatOverrides) => void;
}) {
  const { t } = useTranslation();
  const connection = useAppStore((s) => s.connection);
  const userName = useAppStore((s) => s.userName);
  const userPersona = useAppStore((s) => s.userPersona);

  const [form, setForm] = useState<StartChatOverrides>({
    description: '',
    personality: '',
    first_mes: '',
  });
  const [generatingFirstMes, setGeneratingFirstMes] = useState(false);

  const { data: scenarios = [] } = useQuery({
    queryKey: ['scenarios'],
    queryFn: getScenarios,
    enabled: open,
  });

  useEffect(() => {
    if (character && open) {
      setForm({
        description: character.description ?? '',
        personality: character.personality ?? '',
        first_mes: '',
        activeScenarioName: undefined,
      });
      setGeneratingFirstMes(false);
    }
  }, [character, open]);

  if (!character) return null;

  const isEmptyChar = character.avatar === NO_CHARACTER_AVATAR;

  const updateField = (field: keyof StartChatOverrides, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleGenerateFirstMes = async () => {
    if (generatingFirstMes || !connection.connected || isEmptyChar) return;
    setGeneratingFirstMes(true);
    try {
      // Load scenario content if selected
      let scenarioContent: string | undefined;
      if (form.activeScenarioName) {
        try {
          const s = await getScenario(form.activeScenarioName);
          scenarioContent = s.content;
        } catch {
          /* ignore */
        }
      }

      const userCtx = userName ? { name: userName, persona: userPersona || undefined } : undefined;
      const result = await generateFirstMessage(
        { name: character.name, description: form.description, personality: form.personality },
        scenarioContent,
        userCtx,
      );
      setForm((prev) => ({ ...prev, first_mes: result }));
    } catch (err) {
      console.error('Failed to generate first message:', err);
    } finally {
      setGeneratingFirstMes(false);
    }
  };

  const modalTitle = isEmptyChar
    ? t('characters.startFreeChatTitle')
    : t('characters.startChatTitle', { characterName: character.name });

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="lg">
      <div className="flex flex-col max-h-[70vh]">
        <div className="flex flex-col gap-4 p-5 overflow-y-auto flex-1 min-h-0">
          {isEmptyChar ? (
            <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] rounded-lg p-3">
              {t('characters.freeChatDescription')}
            </div>
          ) : (
            <>
              <div className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] rounded-lg p-3">
                {t('characters.overrideHint')}
              </div>

              <ClearableField
                label={t('characters.descriptionLabel')}
                value={form.description}
                onChange={(v) => updateField('description', v)}
                placeholder={t('characters.descriptionOverridePlaceholder')}
                clearLabel={t('common.clear')}
              />
              <ClearableField
                label={t('characters.personalityField')}
                value={form.personality}
                onChange={(v) => updateField('personality', v)}
                placeholder={t('characters.personalityOverridePlaceholder')}
                clearLabel={t('common.clear')}
              />
            </>
          )}

          {/* First message with generate button */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--color-text)] uppercase tracking-wide">
                {t('characters.firstMessageLabel')}
              </label>
              <div className="flex items-center gap-2">
                {connection.connected && !isEmptyChar && (
                  <button
                    onClick={handleGenerateFirstMes}
                    disabled={generatingFirstMes}
                    className="flex items-center gap-1 text-[10px] text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 disabled:opacity-50 transition-colors cursor-pointer"
                    title={t('characters.generateFirstMessageTooltip')}
                  >
                    {generatingFirstMes ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    {generatingFirstMes ? t('common.generating') : t('common.generate')}
                  </button>
                )}
                {form.first_mes && (
                  <button
                    onClick={() => updateField('first_mes', '')}
                    className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
                    title={t('common.clear')}
                  >
                    <X size={10} />
                    {t('common.clear')}
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={form.first_mes}
              onChange={(e) => updateField('first_mes', e.target.value)}
              placeholder={t('characters.firstMessagePlaceholder')}
              rows={3}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors resize-y min-h-[60px]"
            />
          </div>

          {/* Scenario selector */}
          {scenarios.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                <FileText size={12} />
                {t('characters.scenarioLabel')}
              </label>
              <select
                value={form.activeScenarioName ?? ''}
                onChange={(e) => {
                  const scenarioName = e.target.value || undefined;
                  setForm((prev) => ({ ...prev, activeScenarioName: scenarioName }));
                }}
                className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-colors cursor-pointer"
              >
                <option value="">{t('characters.noScenario')}</option>
                {scenarios.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-[var(--color-text-muted)] opacity-60">
                {t('characters.scenarioHint')}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-[var(--color-border)] bg-[var(--color-background)] flex-shrink-0">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onConfirm(form)}>
            <MessageCircle size={14} />
            {t('characters.startChat')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Characters Page ─────────────────────────────────────────────────────────

export function CharactersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [manualCreateOpen, setManualCreateOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortField, _setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [detailChar, setDetailChar] = useState<Character | null>(null);
  const [startChatChar, setStartChatChar] = useState<Character | null>(null);
  const [chatCounts, setChatCounts] = useState<Record<string, number>>({});
  const [avatarVersion, setAvatarVersion] = useState(0);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    data: characters = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['characters'],
    queryFn: getCharacters,
  });

  // Fetch chat counts for all characters (runs once after characters load)
  useEffect(() => {
    if (characters.length === 0) return;
    let cancelled = false;
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.allSettled(
        characters.map(async (c) => {
          if (!c.avatar) return;
          try {
            const chats = await getCharacterChats(c.avatar);
            counts[c.avatar] = chats.length;
          } catch {
            // ignore errors for individual characters
          }
        }),
      );
      if (!cancelled) setChatCounts(counts);
    };
    fetchCounts();
    return () => {
      cancelled = true;
    };
  }, [characters]);

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const c of characters) {
      for (const t of c.tags ?? []) {
        if (t && typeof t === 'string') tags.add(t);
      }
    }
    return Array.from(tags).sort();
  }, [characters]);

  // Filter and sort
  const filtered = useMemo(() => {
    const result = characters.filter((c) => {
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase());
      const matchesTag = !selectedTag || (c.tags ?? []).includes(selectedTag);
      return matchesSearch && matchesTag;
    });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'tags') {
        cmp = (a.tags?.length ?? 0) - (b.tags?.length ?? 0);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [characters, search, selectedTag, sortField, sortDir]);

  const handleWizardComplete = () => {
    setWizardOpen(false);
    queryClient.invalidateQueries({ queryKey: ['characters'] });
  };

  const handleStartChat = (character: Character) => {
    if (!character.avatar) return;
    setStartChatChar(character);
  };

  const handleStartEmptyChat = async () => {
    try {
      const chatId = await createNewChat(NO_CHARACTER_AVATAR, '', '');
      useAppStore.getState().upsertChatSession({
        characterAvatar: NO_CHARACTER_AVATAR,
        characterName: t('characters.freeChat'),
        chatFile: chatId,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        messageCount: 0,
      });
      navigate(`/chat/${encodeURIComponent(chatId)}`);
    } catch (err) {
      console.error('Failed to start free chat:', err);
    }
  };

  const handleConfirmStartChat = async (overrides: StartChatOverrides) => {
    if (!startChatChar?.avatar) return;
    const isEmptyChar = startChatChar.avatar === NO_CHARACTER_AVATAR;
    try {
      // Replace {{char}}/{{user}} placeholders with actual names before saving
      const resolvedFirstMes = overrides.first_mes
        .replace(/\{\{char\}\}/gi, startChatChar.name || '')
        .replace(/\{\{user\}\}/gi, useAppStore.getState().userName || 'User');
      const chatId = await createNewChat(startChatChar.avatar, startChatChar.name, resolvedFirstMes);

      // Build character overrides — only store fields that differ from the card
      const charOverrides: Partial<Character> = {};
      if (!isEmptyChar) {
        if (overrides.description !== (startChatChar.description ?? ''))
          charOverrides.description = overrides.description;
        if (overrides.personality !== (startChatChar.personality ?? ''))
          charOverrides.personality = overrides.personality;
      }

      useAppStore.getState().upsertChatSession({
        characterAvatar: startChatChar.avatar,
        characterName: startChatChar.name || t('characters.freeChat'),
        chatFile: chatId,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        messageCount: resolvedFirstMes ? 1 : 0,
        lastMessagePreview: resolvedFirstMes?.slice(0, 120),
        ...(Object.keys(charOverrides).length > 0 ? { characterOverrides: charOverrides } : {}),
        ...(overrides.activeScenarioName ? { activeScenarioName: overrides.activeScenarioName } : {}),
      });
      setStartChatChar(null);
      navigate(`/chat/${encodeURIComponent(chatId)}`);
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  const handleOpenChat = (_avatar: string, chatFile: string) => {
    navigate(`/chat/${encodeURIComponent(chatFile)}`);
  };

  const toggleSort = () => {
    if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortDir('asc');
    }
  };

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder={t('characters.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>

          {/* View mode toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer"
            title={viewMode === 'grid' ? t('characters.viewList') : t('characters.viewGrid')}
          >
            {viewMode === 'grid' ? <List size={14} /> : <LayoutGrid size={14} />}
          </button>

          {/* Sort button */}
          <button
            onClick={toggleSort}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer"
            title={sortDir === 'asc' ? t('characters.sortAZ') : t('characters.sortZA')}
          >
            {sortDir === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
          </button>

          <div className="relative">
            <Button onClick={() => setCreateMenuOpen((v) => !v)}>
              <Plus size={15} />
              {t('common.create')}
              <ChevronDown size={12} />
            </Button>
            {createMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setCreateMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-30 overflow-hidden min-w-[180px]">
                  <button
                    onClick={() => {
                      setCreateMenuOpen(false);
                      setWizardOpen(true);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                  >
                    <Sparkles size={14} className="text-[var(--color-primary)]" />
                    {t('characters.aiGeneration')}
                  </button>
                  <button
                    onClick={() => {
                      setCreateMenuOpen(false);
                      setManualCreateOpen(true);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                  >
                    <FileText size={14} className="text-[var(--color-accent)]" />
                    {t('common.manual')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tag filter (collapsible) */}
        {allTags.length > 0 && (
          <div>
            <button
              onClick={() => setTagsExpanded(!tagsExpanded)}
              className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
            >
              <ChevronRight size={12} className={clsx('transition-transform', tagsExpanded && 'rotate-90')} />
              <Tag size={12} />
              <span>{t('characters.tagsCount', { count: allTags.length })}</span>
              {selectedTag && (
                <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[10px]">
                  {selectedTag}
                </span>
              )}
            </button>
            {tagsExpanded && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2 ml-5">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={clsx(
                      'text-xs px-2 py-0.5 rounded-full transition-colors cursor-pointer',
                      selectedTag === tag
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50',
                    )}
                  >
                    {tag}
                  </button>
                ))}
                {selectedTag && (
                  <button
                    onClick={() => setSelectedTag(null)}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors cursor-pointer ml-1"
                    title={t('characters.resetFilter')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Character count */}
      <div className="text-xs text-[var(--color-text-muted)]">
        {t('characters.countOf', { filtered: filtered.length, total: characters.length })}
        {selectedTag && (
          <span>
            {' '}
            · {t('characters.tagLabel')} <span className="text-[var(--color-primary)]">{selectedTag}</span>
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-[var(--color-text-muted)]">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">{t('characters.loading')}</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-[var(--color-danger)]">
            {t('characters.loadError', { error: String(error) })}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4 overflow-y-auto pb-4">
          {/* "Without character" card — always first */}
          <div
            onClick={handleStartEmptyChat}
            className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-xl overflow-hidden hover:border-[var(--color-primary)]/50 transition-colors group cursor-pointer relative"
          >
            <div className="aspect-[3/4] bg-[var(--color-surface-2)] relative overflow-hidden flex items-center justify-center">
              <MessageSquareDashed
                size={48}
                className="text-[var(--color-border)] group-hover:text-[var(--color-primary)]/40 transition-colors"
              />
            </div>
            <div className="p-3">
              <div className="font-medium text-sm text-[var(--color-text-muted)]">{t('characters.noCharacter')}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1 opacity-60">
                {t('characters.freeChatHint')}
              </div>
            </div>
          </div>

          {filtered.map((character) => (
            <CharacterCard
              key={character.avatar ?? character.name}
              character={character}
              chatCount={character.avatar ? chatCounts[character.avatar] : undefined}
              avatarVersion={avatarVersion}
              onStartChat={handleStartChat}
              onViewDetails={setDetailChar}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-y-auto pb-4">
          {/* "Without character" list item — always first */}
          <div
            onClick={handleStartEmptyChat}
            className="flex items-center gap-3 px-3 py-2.5 bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)]/50 transition-colors group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] flex-shrink-0 flex items-center justify-center">
              <MessageSquareDashed
                size={18}
                className="text-[var(--color-border)] group-hover:text-[var(--color-primary)]/40 transition-colors"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-[var(--color-text-muted)]">{t('characters.noCharacter')}</div>
              <div className="text-xs text-[var(--color-text-muted)] opacity-60">{t('characters.freeChatHint')}</div>
            </div>
          </div>

          {filtered.map((character) => (
            <CharacterListItem
              key={character.avatar ?? character.name}
              character={character}
              chatCount={character.avatar ? chatCounts[character.avatar] : undefined}
              avatarVersion={avatarVersion}
              onStartChat={handleStartChat}
              onViewDetails={setDetailChar}
            />
          ))}
        </div>
      )}

      {/* Character detail modal */}
      <CharacterDetailModal
        character={detailChar}
        open={!!detailChar}
        onClose={() => setDetailChar(null)}
        onStartChat={handleStartChat}
        onOpenChat={handleOpenChat}
        avatarVersion={avatarVersion}
        onCharacterUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['characters'] });
          setAvatarVersion((v) => v + 1);
          setDetailChar(null);
        }}
        onCharacterDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ['characters'] });
          setDetailChar(null);
        }}
      />

      {/* Wizard modal */}
      <CharacterWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onComplete={handleWizardComplete} />

      {/* Manual create modal */}
      <ManualCharacterModal
        open={manualCreateOpen}
        onClose={() => setManualCreateOpen(false)}
        onComplete={handleWizardComplete}
      />

      {/* Start chat modal */}
      <StartChatModal
        character={startChatChar}
        open={!!startChatChar}
        onClose={() => setStartChatChar(null)}
        onConfirm={handleConfirmStartChat}
      />
    </div>
  );
}
