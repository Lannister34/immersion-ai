import { type ReactNode, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '@/stores';
import { getConnectionStatus } from '@/api';

interface AppLayoutProps {
  children: ReactNode;
}

const POLL_CONNECTED = 30_000;    // 30s when connected
const POLL_DISCONNECTED = 3_000;  // 3s when disconnected — fast reconnect

export function AppLayout({ children }: AppLayoutProps) {
  const setConnection = useAppStore((s) => s.setConnection);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const scheduleCheck = useCallback((delay: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      const status = await getConnectionStatus();
      if (!mountedRef.current) return;
      setConnection(status);
      scheduleCheck(status.connected ? POLL_CONNECTED : POLL_DISCONNECTED);
    }, delay);
  }, [setConnection]);

  useEffect(() => {
    mountedRef.current = true;
    // Immediate check on mount, then adaptive polling
    (async () => {
      const status = await getConnectionStatus();
      if (!mountedRef.current) return;
      setConnection(status);
      scheduleCheck(status.connected ? POLL_CONNECTED : POLL_DISCONNECTED);
    })();
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [setConnection, scheduleCheck]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <Sidebar />
      {/* Mobile overlay backdrop when sidebar is open */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => useAppStore.getState().toggleSidebar()}
        />
      )}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
