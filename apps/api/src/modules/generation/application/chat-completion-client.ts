import type { ChatReplyPromptMessage } from '../../prompting/application/build-chat-reply-prompt.js';

export interface ChatCompletionRequest {
  maxTokens: number;
  messages: ChatReplyPromptMessage[];
}

export interface ChatCompletionResponse {
  content: string;
}

export interface ChatCompletionClient {
  completeChat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}
