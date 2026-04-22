import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import { ApiError } from '../../shared/api/client';
import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';
import { RouteStatusScreen } from '../../shared/ui/route-status-screen';
import { ChatComposerPanel } from '../chat-composer';
import {
  ChatReplyPromptPreviewPanel,
  chatReplyPromptPreviewQueryOptions,
  generationReadinessQueryOptions,
  toGenerationAvailabilityViewModel,
  useChatReplyGeneration,
} from '../generation';
import { createChat } from './api/create-chat';
import { ChatCreatePanel } from './components/chat-create-panel';
import { ChatListPanel } from './components/chat-list-panel';
import { ChatSessionPanel } from './components/chat-session-panel';
import { chatListQueryKey, chatListQueryOptions } from './queries/chat-list-query';
import { chatSessionQueryOptions } from './queries/chat-session-query';

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
  const [draftMessage, setDraftMessage] = useState('');
  const deferredDraftMessage = useDeferredValue(draftMessage);
  const chatSessionQuery = useQuery(chatSessionQueryOptions(chatId));
  const generationReadinessQuery = useQuery(generationReadinessQueryOptions());
  const promptPreviewQuery = useQuery(chatReplyPromptPreviewQueryOptions(chatId, deferredDraftMessage));
  const chatReplyGeneration = useChatReplyGeneration(chatId);

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
  const jobErrorMessage =
    chatReplyGeneration.latestJob?.status === 'failed' ? chatReplyGeneration.latestJob.error?.message : undefined;
  const generationErrorMessage = chatReplyGeneration.error
    ? getGenerationErrorMessage(chatReplyGeneration.error)
    : jobErrorMessage;

  return (
    <div className="stack">
      <ChatSessionPanel session={chatSessionQuery.data} />
      <ChatReplyPromptPreviewPanel
        isError={promptPreviewQuery.isError}
        isLoading={promptPreviewQuery.isLoading}
        isRefreshing={promptPreviewQuery.isRefetching}
        onRefresh={() => {
          void promptPreviewQuery.refetch();
        }}
        preview={promptPreviewQuery.data}
      />
      {generationErrorMessage ? <div className="note note--danger">{generationErrorMessage}</div> : null}
      <ChatComposerPanel
        canCancel={Boolean(chatReplyGeneration.activeJob)}
        draftMessage={draftMessage}
        isSending={chatReplyGeneration.isPending}
        onCancel={chatReplyGeneration.cancel}
        onDraftMessageChange={setDraftMessage}
        onSend={async (message) => {
          await chatReplyGeneration.start(message);
        }}
        sendBlockReason={generationAvailability.blockReason}
      />
    </div>
  );
}
