import {
  type StartChatReplyGenerationCommand,
  StartChatReplyGenerationCommandSchema,
  StartChatReplyGenerationJobResponseSchema,
} from '@immersion/contracts/generation';

import { apiPost } from '../../../shared/api/client';

export function startChatReplyGenerationJob(command: StartChatReplyGenerationCommand) {
  return apiPost(
    '/api/generation/chat-reply-jobs',
    command,
    StartChatReplyGenerationCommandSchema,
    StartChatReplyGenerationJobResponseSchema,
  );
}
