import type { ChatSessionDto } from '@immersion/contracts/chats';
import type { ApiProblem } from '@immersion/contracts/common';

export class ProviderGenerationError extends Error {
  constructor(message = 'Provider failed to generate a reply.') {
    super(message);
    this.name = 'ProviderGenerationError';
  }
}

export class ChatReplyGenerationFailedError extends Error {
  declare readonly session: ChatSessionDto;

  constructor(
    readonly statusCode: number,
    readonly code: ApiProblem['code'],
    message: string,
    session: ChatSessionDto,
  ) {
    super(message);
    this.name = 'ChatReplyGenerationFailedError';
    Object.defineProperty(this, 'session', {
      value: session,
      enumerable: false,
      writable: false,
    });
  }
}
