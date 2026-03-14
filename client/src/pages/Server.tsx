import { Globe, RefreshCw, Server } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getConnectionStatus } from '@/api';
import { ConnectionConfig } from '@/components/ConnectionConfig';
import { ModelManager } from '@/components/ModelManager';
import { Button } from '@/components/ui/Button';
import { getActiveProviderConfig, useAppStore } from '@/stores';

export function ServerPage() {
  const { t } = useTranslation();
  const { connection, setConnection, backendMode, setBackendMode } = useAppStore();
  const { url: connectionUrl, apiKey: connectionApiKey } = useAppStore(getActiveProviderConfig);

  const [testing, setTesting] = useState(false);

  // Auto-check connection when provider URL changes (only for external mode)
  useEffect(() => {
    if (backendMode !== 'external') return;
    let cancelled = false;
    const check = async () => {
      try {
        const status = await getConnectionStatus({ url: connectionUrl, apiKey: connectionApiKey });
        if (!cancelled) setConnection(status);
      } catch {
        if (!cancelled) setConnection({ connected: false });
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [backendMode, connectionUrl, connectionApiKey, setConnection]);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    try {
      const status = await getConnectionStatus();
      setConnection(status);
    } finally {
      setTesting(false);
    }
  }, [setConnection]);

  const handleSetBuiltin = useCallback(() => setBackendMode('builtin'), [setBackendMode]);
  const handleSetExternal = useCallback(() => setBackendMode('external'), [setBackendMode]);

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col gap-4 sm:gap-6 pb-8 flex-1 overflow-y-auto p-3 sm:p-5">
      <section className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 sm:p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('server.backendTitle')}</h2>

        <div className="flex items-center gap-1 bg-[var(--color-surface-2)] rounded-lg p-0.5 w-fit">
          <button
            onClick={handleSetBuiltin}
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
            onClick={handleSetExternal}
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

        {backendMode === 'builtin' && <ModelManager />}

        {backendMode === 'external' && (
          <>
            <ConnectionConfig />

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
          </>
        )}
      </section>
    </div>
  );
}
