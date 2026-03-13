import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { CharactersPage } from '@/pages/Characters';
import { LorebooksPage } from '@/pages/Lorebooks';
import { SettingsPage } from '@/pages/Settings';
import { ScenariosPage } from '@/pages/Scenarios';
import { ServerPage } from '@/pages/Server';
import { ChatPage } from '@/pages/Chat';
import { ActiveChatView } from '@/pages/Chat';
import { initSettingsFromServer } from '@/stores';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  // Load settings from server on startup (server = source of truth)
  useEffect(() => {
    initSettingsFromServer();
  }, []);

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
