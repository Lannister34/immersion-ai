import {
  type UpdateChatGenerationSettingsCommand,
  UpdateChatGenerationSettingsCommandSchema,
  UpdateChatGenerationSettingsResponseSchema,
} from '@immersion/contracts/chats';

import { apiPut } from '../../../shared/api/client';

export function updateChatGenerationSettings(chatId: string, command: UpdateChatGenerationSettingsCommand) {
  return apiPut(
    `/api/chats/${chatId}/generation-settings`,
    command,
    UpdateChatGenerationSettingsCommandSchema,
    UpdateChatGenerationSettingsResponseSchema,
  );
}
