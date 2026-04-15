import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';

export { generateChatReply } from './api/generate-chat-reply';
export {
  generationReadinessQueryKey,
  generationReadinessQueryOptions,
} from './queries/generation-readiness-query';
export { toGenerationAvailabilityViewModel } from './view-models/generation-availability';

export function GenerationPanel() {
  return (
    <PlaceholderScreen
      eyebrow="генерация"
      title="Стриминг и управление генерацией"
      description="Здесь будет только UI orchestration вокруг streaming, cancel и invalidate/refetch, без прямой записи chat state."
    />
  );
}
