import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { initI18n } from '@/i18n';
import { CharactersPage } from '@/pages/Characters';
import { ActiveChatView, ChatPage } from '@/pages/Chat';
import { LorebooksPage } from '@/pages/Lorebooks';
import { ScenariosPage } from '@/pages/Scenarios';
import { ServerPage } from '@/pages/Server';
import { SettingsPage } from '@/pages/Settings';
import { initSettingsFromServer, useAppStore } from '@/stores';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function App() {
  // Load settings from server on startup (server = source of truth)
  useEffect(() => {
    initSettingsFromServer();
  }, []);

  // Sync i18n language with store
  const uiLanguage = useAppStore((s) => s.uiLanguage);
  useEffect(() => {
    initI18n(uiLanguage);
  }, [uiLanguage]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/:chatId" element={<ActiveChatView />} />
            <Route path="/characters" element={<CharactersPage />} />
            <Route path="/lorebooks" element={<LorebooksPage />} />
            <Route path="/scenarios" element={<ScenariosPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/server" element={<ServerPage />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
