import {
  type ChatReplyPromptPreviewCommand,
  ChatReplyPromptPreviewCommandSchema,
  ChatReplyPromptPreviewResponseSchema,
} from '@immersion/contracts/generation';

import { apiPost } from '../../../shared/api/client';

export function previewChatReplyPrompt(command: ChatReplyPromptPreviewCommand) {
  return apiPost(
    '/api/generation/chat-reply-preview',
    command,
    ChatReplyPromptPreviewCommandSchema,
    ChatReplyPromptPreviewResponseSchema,
  );
}
