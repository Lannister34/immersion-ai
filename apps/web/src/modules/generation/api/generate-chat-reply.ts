import {
  ChatReplyGenerationResponseSchema,
  type StartChatReplyGenerationCommand,
  StartChatReplyGenerationCommandSchema,
} from '@immersion/contracts/generation';

import { apiPost } from '../../../shared/api/client';

export function generateChatReply(command: StartChatReplyGenerationCommand) {
  return apiPost(
    '/api/generation/chat-reply',
    command,
    StartChatReplyGenerationCommandSchema,
    ChatReplyGenerationResponseSchema,
  );
}
