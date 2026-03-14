import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '@/api';
import { useAppStore } from '@/stores';
import type { ChatSessionMeta } from '@/types';

export function useChatList() {
  const chatSessions = useAppStore((s) => s.chatSessions);
  const removeChatSession = useAppStore((s) => s.removeChatSession);
  const [search, setSearch] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatSessionMeta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteChat(deleteTarget.characterAvatar, deleteTarget.chatFile);
    } catch (err) {
      // File already gone on disk — still clean up the session
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (!msg.includes('404') && !msg.includes('not found')) {
        console.error('Failed to delete chat:', err);
      }
    }
    removeChatSession(deleteTarget.characterAvatar, deleteTarget.chatFile);
    setDeleteTarget(null);
    setIsDeleting(false);
  }, [deleteTarget, removeChatSession]);

  const handleDeleteCancel = useCallback(() => {
    if (!isDeleting) setDeleteTarget(null);
  }, [isDeleting]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  // Sync all chat sessions from backend in a single API call
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      setLoadingChats(true);
      try {
        const allChats = await api.getAllChats();
        if (cancelled) return;

        const { upsertChatSession, chatSessions: existing } = useAppStore.getState();
        for (const chat of allChats) {
          const already = existing.find(
            (s) => s.characterAvatar === chat.characterAvatar && s.chatFile === chat.chatFile,
          );
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
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingChats(false);
      }
    };
    sync();
    return () => {
      cancelled = true;
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
