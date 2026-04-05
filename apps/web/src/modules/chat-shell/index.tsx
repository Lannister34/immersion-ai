import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';
import { StartChatPanel } from '../chat-start';

export function HomeScreen() {
  return (
    <div className="stack">
      <PlaceholderScreen
        eyebrow="этап 1"
        title="Основа переписывания Immersion AI"
        description="Новый workspace уже разделяет app shell, маршруты, модули и shared-слой. Отсюда можно безопасно переносить вертикальные срезы без наращивания legacy-архитектуры."
        bullets={[
          'Backend ownership остаётся каноническим для file-backed данных.',
          'Frontend server state идёт через TanStack Query.',
          'Route state живёт в TanStack Router, а не в ad hoc store.',
        ]}
      />
      <StartChatPanel />
    </div>
  );
}
