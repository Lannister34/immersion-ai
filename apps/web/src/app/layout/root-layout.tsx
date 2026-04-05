import { Link, Outlet } from '@tanstack/react-router';

import { useUiShellStore } from '../store/ui-shell';

const navItems = [
  { to: '/', label: 'Обзор' },
  { to: '/chat', label: 'Чаты' },
  { to: '/characters', label: 'Персонажи' },
  { to: '/lorebooks', label: 'Лорбуки' },
  { to: '/scenarios', label: 'Сценарии' },
  { to: '/server', label: 'Сервер' },
  { to: '/settings', label: 'Настройки' },
] as const;

export function RootLayout() {
  const sidebarCollapsed = useUiShellStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiShellStore((state) => state.toggleSidebar);

  return (
    <div className={`shell ${sidebarCollapsed ? 'shell--collapsed' : ''}`}>
      <aside className="shell__sidebar">
        <div className="shell__header">
          <strong>{sidebarCollapsed ? 'IA' : 'Immersion AI'}</strong>
          <button className="shell__toggle" onClick={toggleSidebar} type="button">
            {sidebarCollapsed ? '>' : '<'}
          </button>
        </div>
        <nav className="shell__nav">
          {navItems.map((item) => (
            <Link key={item.to} activeProps={{ 'data-status': 'active' }} className="shell__link" to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="shell__content">
        <Outlet />
      </main>
    </div>
  );
}
