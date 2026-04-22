import { queryOptions } from '@tanstack/react-query';

import { previewChatReplyPrompt } from '../api/preview-chat-reply-prompt';

export const chatReplyPromptPreviewQueryBaseKey = (chatId: string) =>
  ['generation', 'chat-reply-preview', chatId] as const;

export const chatReplyPromptPreviewQueryKey = (chatId: string, draftUserMessage = '') =>
  [...chatReplyPromptPreviewQueryBaseKey(chatId), draftUserMessage.trim()] as const;

export function chatReplyPromptPreviewQueryOptions(chatId: string, draftUserMessage = '') {
  const normalizedDraftUserMessage = draftUserMessage.trim();

  return queryOptions({
    queryKey: chatReplyPromptPreviewQueryKey(chatId, normalizedDraftUserMessage),
    queryFn: () =>
      previewChatReplyPrompt({
        chatId,
        draftUserMessage: normalizedDraftUserMessage || undefined,
      }),
  });
}
