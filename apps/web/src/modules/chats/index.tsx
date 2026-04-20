import type { ChatSessionDto } from '@immersion/contracts/chats';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useRef } from 'react';
import { ApiError } from '../../shared/api/client';
import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';
import { RouteStatusScreen } from '../../shared/ui/route-status-screen';
import { ChatComposerPanel } from '../chat-composer';
import {
  generateChatReply,
  generationReadinessQueryKey,
  generationReadinessQueryOptions,
  toGenerationAvailabilityViewModel,
} from '../generation';
import { createChat } from './api/create-chat';
import { ChatCreatePanel } from './components/chat-create-panel';
import { ChatListPanel } from './components/chat-list-panel';
import { ChatSessionPanel } from './components/chat-session-panel';
import { chatListQueryKey, chatListQueryOptions } from './queries/chat-list-query';
import { chatSessionQueryKey, chatSessionQueryOptions } from './queries/chat-session-query';
import { appendOptimisticUserMessage } from './view-models/optimistic-chat-session';

interface ChatSessionScreenProps {
  chatId: string;
}

interface GenerateChatReplyMutationVariables {
  message: string;
  signal: AbortSignal;
}

function createOptimisticMessageId() {
  return `optimistic:${
    typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}:${Math.random()}`
  }`;
}

function isAbortError(error: unknown) {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

function getGenerationErrorMessage(error: unknown) {
  if (isAbortError(error)) {
    return undefined;
  }

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
  const generationAbortControllerRef = useRef<AbortController | null>(null);
  const chatSessionQuery = useQuery(chatSessionQueryOptions(chatId));
  const generationReadinessQuery = useQuery(generationReadinessQueryOptions());
  const generateMutation = useMutation({
    mutationFn: ({ message, signal }: GenerateChatReplyMutationVariables) =>
      generateChatReply(
        {
          chatId,
          message,
        },
        {
          signal,
        },
      ),
    onMutate: async ({ message }) => {
      await queryClient.cancelQueries({
        queryKey: chatSessionQueryKey(chatId),
      });

      const currentSession = queryClient.getQueryData<ChatSessionDto>(chatSessionQueryKey(chatId));

      if (!currentSession) {
        return;
      }

      queryClient.setQueryData(
        chatSessionQueryKey(chatId),
        appendOptimisticUserMessage(currentSession, {
          content: message,
          createdAt: new Date().toISOString(),
          id: createOptimisticMessageId(),
        }),
      );
    },
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

  const generationAvailability = toGenerationAvailabilityViewModel({
    isError: generationReadinessQuery.isError,
    isLoading: generationReadinessQuery.isLoading,
    readiness: generationReadinessQuery.data,
  });
  const generationErrorMessage = generateMutation.isError
    ? getGenerationErrorMessage(generateMutation.error)
    : undefined;

  return (
    <div className="stack">
      <ChatSessionPanel session={chatSessionQuery.data} />
      {generationErrorMessage ? <div className="note note--danger">{generationErrorMessage}</div> : null}
      <ChatComposerPanel
        canCancel={generateMutation.isPending}
        isSending={generateMutation.isPending}
        onCancel={() => {
          generationAbortControllerRef.current?.abort();
        }}
        onSend={async (message) => {
          const abortController = new AbortController();
          generationAbortControllerRef.current = abortController;

          try {
            await generateMutation.mutateAsync({
              message,
              signal: abortController.signal,
            });
          } finally {
            if (generationAbortControllerRef.current === abortController) {
              generationAbortControllerRef.current = null;
            }
          }
        }}
        sendBlockReason={generationAvailability.blockReason}
      />
    </div>
  );
}
