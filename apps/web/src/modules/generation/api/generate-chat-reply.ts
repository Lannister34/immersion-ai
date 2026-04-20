import {
  ChatReplyGenerationResponseSchema,
  type StartChatReplyGenerationCommand,
  StartChatReplyGenerationCommandSchema,
} from '@immersion/contracts/generation';

import { type ApiRequestOptions, apiPost } from '../../../shared/api/client';

export function generateChatReply(command: StartChatReplyGenerationCommand, options: ApiRequestOptions = {}) {
  return apiPost(
    '/api/generation/chat-reply',
    command,
    StartChatReplyGenerationCommandSchema,
    ChatReplyGenerationResponseSchema,
    options,
  );
}
