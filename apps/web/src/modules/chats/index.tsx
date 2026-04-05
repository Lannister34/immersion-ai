import { PlaceholderScreen } from '../../shared/ui/placeholder-screen';
import { ChatComposerPanel } from '../chat-composer';
import { GenerationPanel } from '../generation';

interface ChatSessionScreenProps {
  chatId: string;
}

export function ChatListScreen() {
  return (
    <PlaceholderScreen
      eyebrow="чаты"
      title="Чаты"
      description="Этот экран станет доменной точкой входа для списка чатов, поиска, summaries и deep-link navigation."
      bullets={[
        'Query keys и invalidation будут жить внутри модуля chats.',
        'Zustand не будет владеть canonical chat summaries.',
      ]}
    />
  );
}

export function ChatSessionScreen({ chatId }: ChatSessionScreenProps) {
  return (
    <div className="stack stack--two">
      <PlaceholderScreen
        eyebrow="чаты"
        title={`Сессия чата ${chatId}`}
        description="Session view будет читать canonical metadata и transcript через module-owned query layer."
      />
      <ChatComposerPanel />
      <GenerationPanel />
    </div>
  );
}
