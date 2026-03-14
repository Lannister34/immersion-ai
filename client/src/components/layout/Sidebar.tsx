import { clsx } from 'clsx';
import { BookOpen, FileText, Menu, MessageCircle, Server, Settings, Users, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores';

interface NavItem {
  path: string;
  labelKey: 'nav.chats' | 'nav.characters' | 'nav.lorebooks' | 'nav.scenarios' | 'nav.api' | 'nav.settings';
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/chat', labelKey: 'nav.chats', icon: <MessageCircle size={18} /> },
  { path: '/characters', labelKey: 'nav.characters', icon: <Users size={18} /> },
  { path: '/lorebooks', labelKey: 'nav.lorebooks', icon: <BookOpen size={18} /> },
  { path: '/scenarios', labelKey: 'nav.scenarios', icon: <FileText size={18} /> },
  { path: '/server', labelKey: 'nav.api', icon: <Server size={18} /> },
  { path: '/settings', labelKey: 'nav.settings', icon: <Settings size={18} /> },
];

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, connection } = useAppStore();

  const handleNav = (path: string) => {
    navigate(path);
    // Auto-close sidebar on mobile after navigation
    if (window.innerWidth < 768 && !sidebarCollapsed) {
      toggleSidebar();
    }
  };

  const isActive = (path: string) => location.pathname.startsWith(path);
  const connectionLabel = connection.connected ? connection.model || 'Connected' : t('nav.noConnection');

  return (
    <aside
      className={clsx(
        'flex flex-col bg-[var(--color-surface)] border-r border-[var(--color-border)] transition-all duration-200 flex-shrink-0',
        // On mobile: fixed overlay when open, hidden when collapsed
        'fixed md:relative z-30 h-full',
        sidebarCollapsed ? 'w-0 md:w-14 overflow-hidden md:overflow-visible' : 'w-56 md:w-52',
      )}
    >
      {/* Logo row */}
      <div className="flex items-center gap-3 px-3 py-4 border-b border-[var(--color-border)]">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer flex-shrink-0"
        >
          <Menu size={18} />
        </button>
        {!sidebarCollapsed && (
          <span className="font-semibold text-sm text-[var(--color-text)] whitespace-nowrap overflow-hidden">
            Immersion AI
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => handleNav(item.path)}
            title={sidebarCollapsed ? t(item.labelKey) : undefined}
            className={clsx(
              'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer w-full',
              isActive(item.path)
                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
            )}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!sidebarCollapsed && <span className="whitespace-nowrap overflow-hidden">{t(item.labelKey)}</span>}
          </button>
        ))}
      </nav>

      {/* Connection status at bottom — click to open API page */}
      <button
        onClick={() => handleNav('/server')}
        title={sidebarCollapsed ? connectionLabel : undefined}
        className={clsx(
          'border-t border-[var(--color-border)] px-3 py-3 flex items-center gap-2.5 w-full cursor-pointer transition-colors hover:bg-[var(--color-surface-2)]',
          sidebarCollapsed && 'justify-center',
        )}
      >
        <div className="relative flex-shrink-0">
          <Zap
            size={14}
            className={connection.connected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]/40'}
          />
          <div
            className={clsx(
              'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-[var(--color-surface)]',
              connection.connected ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-text-muted)]/40',
            )}
          />
        </div>
        {!sidebarCollapsed && (
          <div className="text-[11px] text-[var(--color-text-muted)] truncate leading-tight text-left">
            {connection.connected ? (
              <span className="text-[var(--color-accent)]">{connectionLabel}</span>
            ) : (
              connectionLabel
            )}
          </div>
        )}
      </button>
    </aside>
  );
}
