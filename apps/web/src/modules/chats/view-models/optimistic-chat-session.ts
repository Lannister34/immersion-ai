import type { ChatMessageDto, ChatSessionDto } from '@immersion/contracts/chats';

export interface OptimisticUserMessageInput {
  content: string;
  createdAt: string;
  id: string;
}

export function appendOptimisticUserMessage(
  session: ChatSessionDto,
  input: OptimisticUserMessageInput,
): ChatSessionDto {
  const message: ChatMessageDto = {
    id: input.id,
    role: 'user',
    content: input.content,
    createdAt: input.createdAt,
  };

  return {
    ...session,
    chat: {
      ...session.chat,
      updatedAt: input.createdAt,
      messageCount: session.chat.messageCount + 1,
      lastMessagePreview: input.content,
    },
    messages: [...session.messages, message],
  };
}
