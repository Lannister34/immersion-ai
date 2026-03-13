import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '@/stores';

const pageTitles: Record<string, string> = {
  '/characters': 'Персонажи',
  '/lorebooks': 'Лорбуки',
  '/scenarios': 'Сценарии',
  '/settings': 'Настройки',
  '/chat': 'Чат',
};

export function Header() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const location = useLocation();

  // Hide header on active chat page (it has its own header with hamburger)
  if (location.pathname.startsWith('/chat/')) return null;

  const title = pageTitles[location.pathname] ?? '';

  return (
    <header className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
      <div className="flex items-center gap-2">
        {/* Mobile hamburger - shown when sidebar is collapsed (hidden on mobile) */}
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer md:hidden"
          >
            <Menu size={18} />
          </button>
        )}
        <h1 className="text-base font-semibold text-[var(--color-text)]">
          {title}
        </h1>
      </div>
    </header>
  );
}
