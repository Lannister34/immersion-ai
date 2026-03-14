import { useQuery } from '@tanstack/react-query';
import { Globe, RefreshCw, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getConnectionStatus, getSettings } from '@/api';
import { ModelManager } from '@/components/ModelManager';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores';

export function ServerPage() {
  const { t } = useTranslation();
  const { connection, setConnection, backendMode, setBackendMode } = useAppStore();

  const [testing, setTesting] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  // Auto-check connection on mount (only for external mode)
  useEffect(() => {
    if (backendMode !== 'external') return;
    let cancelled = false;
    const check = async () => {
      try {
        const status = await getConnectionStatus();
        if (!cancelled) setConnection(status);
      } catch {
        if (!cancelled) setConnection({ connected: false });
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [backendMode, setConnection]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const status = await getConnectionStatus();
      setConnection(status);
    } finally {
      setTesting(false);
    }
  };

  const textGen = settings?.textgenerationwebui;
  const apiUrl = textGen?.server_urls?.koboldcpp ?? 'http://127.0.0.1:5001';

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 sm:gap-6 pb-8 flex-1 overflow-y-auto p-3 sm:p-5">
      {/* Backend section */}
      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 sm:p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('server.backendTitle')}</h2>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-[var(--color-surface-2)] rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setBackendMode('builtin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              backendMode === 'builtin'
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <Server size={12} />
            {t('server.builtinMode')}
          </button>
          <button
            onClick={() => setBackendMode('external')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              backendMode === 'external'
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <Globe size={12} />
            {t('server.externalMode')}
          </button>
        </div>

        {/* Builtin mode: ModelManager */}
        {backendMode === 'builtin' && <ModelManager />}

        {/* External mode: existing connection UI */}
        {backendMode === 'external' && (
          <>
            <div className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  connection.connected
                    ? 'bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]'
                    : 'bg-[var(--color-text-muted)]'
                }`}
              />
              <span className="text-sm text-[var(--color-text-muted)]">
                {connection.connected ? t('server.connected', { model: connection.model }) : t('server.disconnected')}
              </span>
              <Button variant="ghost" size="sm" onClick={handleTestConnection} loading={testing} className="ml-auto">
                <RefreshCw size={13} />
                {t('server.checkConnection')}
              </Button>
            </div>

            <div className="text-xs text-[var(--color-text-muted)]">
              API URL: <span className="font-mono bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">{apiUrl}</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
