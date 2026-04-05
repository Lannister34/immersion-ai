import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';

export function ChatComposerPanel() {
  return (
    <PlaceholderScreen
      eyebrow="черновик"
      title="Черновик и локальное состояние"
      description="Этот модуль будет владеть только локальным состоянием ввода и UX отправки, без владения самим transcript."
    />
  );
}
