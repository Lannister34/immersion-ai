import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '@/api';
import { useAppStore } from '@/stores';
import type { ChatSessionMeta } from '@/types';

/**
 * Fetch the authoritative chat list from the server and reconcile
 * the in-memory chatSessions: remove stale entries, upsert current ones.
 */
async function syncSessionsFromServer(): Promise<void> {
  const allChats = await api.getAllChats();
  const { upsertChatSession, removeChatSession, chatSessions: existing } = useAppStore.getState();

  // Remove sessions whose files no longer exist on disk
  const diskKeys = new Set(allChats.map((c) => `${c.characterAvatar}::${c.chatFile}`));
  for (const session of existing) {
    if (!diskKeys.has(`${session.characterAvatar}::${session.chatFile}`)) {
      removeChatSession(session.characterAvatar, session.chatFile);
    }
  }

  // Upsert sessions that do exist on disk
  for (const chat of allChats) {
    const already = existing.find((s) => s.characterAvatar === chat.characterAvatar && s.chatFile === chat.chatFile);
    let lastDate = chat.lastDate;
    if (!Number.isNaN(Number(lastDate))) {
      lastDate = new Date(Number(lastDate)).toISOString();
    }
    upsertChatSession({
      characterAvatar: chat.characterAvatar,
      characterName: chat.characterName,
      chatFile: chat.chatFile,
      createdAt: already?.createdAt ?? lastDate ?? new Date().toISOString(),
      lastActiveAt: lastDate ?? new Date().toISOString(),
      messageCount: chat.messageCount,
      lastMessagePreview: chat.lastMessage,
      title: already?.title,
    });
  }
}

export function useChatList() {
  const chatSessions = useAppStore((s) => s.chatSessions);
  const [search, setSearch] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatSessionMeta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelledRef = useRef(false);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteChat(deleteTarget.characterAvatar, deleteTarget.chatFile);
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (!msg.includes('404') && !msg.includes('not found')) {
        console.error('Failed to delete chat:', err);
      }
    }
    // Re-fetch the authoritative list from the server
    await syncSessionsFromServer().catch(() => {});
    setDeleteTarget(null);
    setIsDeleting(false);
  }, [deleteTarget]);

  const handleDeleteCancel = useCallback(() => {
    if (!isDeleting) setDeleteTarget(null);
  }, [isDeleting]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  // Initial sync from server on mount
  useEffect(() => {
    cancelledRef.current = false;
    const sync = async () => {
      setLoadingChats(true);
      try {
        await syncSessionsFromServer();
      } catch {
        // ignore
      } finally {
        if (!cancelledRef.current) setLoadingChats(false);
      }
    };
    sync();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Flat list sorted by last activity (most recent first), with search filter
  const sortedSessions = useMemo(() => {
    const sessions = [...chatSessions].sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
    );

    if (!search) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(
      (s) =>
        s.characterName.toLowerCase().includes(q) ||
        s.title?.toLowerCase().includes(q) ||
        s.lastMessagePreview?.toLowerCase().includes(q) ||
        s.chatFile.toLowerCase().includes(q),
    );
  }, [chatSessions, search]);

  return {
    search,
    loadingChats,
    deleteTarget,
    isDeleting,
    sortedSessions,
    handleSearchChange,
    handleDeleteConfirm,
    handleDeleteCancel,
    setDeleteTarget,
  };
}
