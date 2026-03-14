import { useCallback, useEffect } from 'react';

/**
 * Manages auto-scroll behavior for a scrollable container.
 * Scrolls to bottom when new content arrives, unless the user scrolled up.
 *
 * The `shouldAutoScroll` ref is owned by the parent so it can be shared
 * with other hooks (e.g., useChatGeneration sets it to true before generating).
 */
export function useAutoScroll(
  messagesEndRef: React.RefObject<HTMLDivElement | null>,
  messagesContainerRef: React.RefObject<HTMLDivElement | null>,
  shouldAutoScroll: React.RefObject<boolean>,
  deps: { messageCount: number; streamText: string },
): {
  handleScroll: () => void;
} {
  const { messageCount, streamText } = deps;

  // Scroll to bottom when new messages arrive or stream updates.
  // messageCount and streamText are intentional trigger deps (not used in the body);
  // refs are accessed via .current and don't need to be in the dep array.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable, primitives are trigger deps
  useEffect(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messageCount, streamText]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100;
  }, []);

  return { handleScroll };
}
