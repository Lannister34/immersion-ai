import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';
import { RouteStatusScreen } from '../../shared/ui/route-status-screen';
import { ChatComposerPanel } from '../chat-composer';
import { generateChatReply } from '../generation/api/generate-chat-reply';
import { createChat } from './api/create-chat';
import { ChatCreatePanel } from './components/chat-create-panel';
import { ChatListPanel } from './components/chat-list-panel';
import { ChatSessionPanel } from './components/chat-session-panel';
import { chatListQueryKey, chatListQueryOptions } from './queries/chat-list-query';
import { chatSessionQueryKey, chatSessionQueryOptions } from './queries/chat-session-query';

interface ChatSessionScreenProps {
  chatId: string;
}

export function ChatListScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const chatListQuery = useQuery(chatListQueryOptions());
  const createMutation = useMutation({
    mutationFn: createChat,
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: chatListQueryKey,
      });
      await navigate({
        to: '/chat/$chatId',
        params: {
          chatId: response.chat.id,
        },
      });
    },
  });

  if (chatListQuery.isLoading) {
    return (
      <PlaceholderScreen eyebrow="чаты" title="Загрузка чатов" description="Получаем сохранённые сессии из backend." />
    );
  }

  if (chatListQuery.isError || !chatListQuery.data) {
    return (
      <RouteStatusScreen
        eyebrow="чаты"
        title="Не удалось загрузить список чатов"
        description="Проверьте backend и повторите попытку."
      />
    );
  }

  return (
    <div className="stack">
      <ChatCreatePanel
        isCreating={createMutation.isPending}
        onCreate={async (title) => {
          await createMutation.mutateAsync({
            title,
          });
        }}
      />
      {createMutation.isError ? (
        <div className="note note--danger">Не удалось создать чат. Проверьте backend и попробуйте ещё раз.</div>
      ) : null}
      <ChatListPanel chats={chatListQuery.data.items} />
    </div>
  );
}

export function ChatSessionScreen({ chatId }: ChatSessionScreenProps) {
  const queryClient = useQueryClient();
  const chatSessionQuery = useQuery(chatSessionQueryOptions(chatId));
  const generateMutation = useMutation({
    mutationFn: generateChatReply,
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: chatListQueryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: chatSessionQueryKey(chatId),
        }),
      ]);
    },
    onSuccess: async (response) => {
      queryClient.setQueryData(chatSessionQueryKey(chatId), response.session);
      await queryClient.invalidateQueries({
        queryKey: chatListQueryKey,
      });
    },
  });

  if (chatSessionQuery.isLoading) {
    return (
      <PlaceholderScreen eyebrow="сессия" title="Загрузка чата" description="Получаем сохранённую сессию из backend." />
    );
  }

  if (chatSessionQuery.isError || !chatSessionQuery.data) {
    return (
      <RouteStatusScreen
        eyebrow="сессия"
        title="Не удалось открыть чат"
        description="Чат не найден или backend не смог прочитать его файл."
      />
    );
  }

  return (
    <div className="stack">
      <ChatSessionPanel session={chatSessionQuery.data} />
      {generateMutation.isError ? (
        <div className="note note--danger">
          Не удалось получить ответ модели. Проверьте, что локальный сервер запущен.
        </div>
      ) : null}
      <ChatComposerPanel
        isSending={generateMutation.isPending}
        onSend={async (message) => {
          await generateMutation.mutateAsync({
            chatId,
            message,
          });
        }}
      />
    </div>
  );
}
