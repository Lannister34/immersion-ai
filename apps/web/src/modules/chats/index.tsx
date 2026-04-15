import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ApiError } from '../../shared/api/client';
import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';
import { RouteStatusScreen } from '../../shared/ui/route-status-screen';
import { ChatComposerPanel } from '../chat-composer';
import { generateChatReply } from '../generation/api/generate-chat-reply';
import { GenerationReadinessNotice } from '../generation/components/generation-readiness-notice';
import {
  generationReadinessQueryKey,
  generationReadinessQueryOptions,
} from '../generation/queries/generation-readiness-query';
import { createChat } from './api/create-chat';
import { ChatCreatePanel } from './components/chat-create-panel';
import { ChatListPanel } from './components/chat-list-panel';
import { ChatSessionPanel } from './components/chat-session-panel';
import { chatListQueryKey, chatListQueryOptions } from './queries/chat-list-query';
import { chatSessionQueryKey, chatSessionQueryOptions } from './queries/chat-session-query';

interface ChatSessionScreenProps {
  chatId: string;
}

function getGenerationErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Не удалось получить ответ модели. Проверьте API и повторите попытку.';
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
  const generationReadinessQuery = useQuery(generationReadinessQueryOptions());
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
        queryClient.invalidateQueries({
          queryKey: generationReadinessQueryKey,
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

  const isReadinessPending = generationReadinessQuery.isLoading && !generationReadinessQuery.data;
  const isGenerationBlocked =
    isReadinessPending || generationReadinessQuery.isError || generationReadinessQuery.data?.status === 'blocked';
  let composerDisabledMessage: string | undefined;

  if (isReadinessPending) {
    composerDisabledMessage = 'Проверяем готовность LLM...';
  } else if (generationReadinessQuery.isError) {
    composerDisabledMessage = 'Не удалось проверить готовность LLM. Откройте API и проверьте состояние провайдера.';
  } else if (generationReadinessQuery.data?.status === 'blocked') {
    composerDisabledMessage = 'Генерация недоступна. Подготовьте провайдер на странице API.';
  }

  return (
    <div className="stack">
      <ChatSessionPanel session={chatSessionQuery.data} />
      <GenerationReadinessNotice
        isError={generationReadinessQuery.isError}
        isLoading={isReadinessPending}
        readiness={generationReadinessQuery.data}
      />
      {generateMutation.isError ? (
        <div className="note note--danger">{getGenerationErrorMessage(generateMutation.error)}</div>
      ) : null}
      <ChatComposerPanel
        disabledMessage={composerDisabledMessage}
        isDisabled={isGenerationBlocked}
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
