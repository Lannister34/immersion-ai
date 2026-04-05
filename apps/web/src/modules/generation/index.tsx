import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';

export function GenerationPanel() {
  return (
    <PlaceholderScreen
      eyebrow="генерация"
      title="Стриминг и управление генерацией"
      description="Здесь будет только UI orchestration вокруг streaming, cancel и invalidate/refetch, без прямой записи chat state."
    />
  );
}
