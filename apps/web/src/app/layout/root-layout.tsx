import { Link, Outlet } from '@tanstack/react-router';

const navItems = [
  { to: '/chat', label: 'Чаты' },
  { to: '/server', label: 'API' },
] as const;

export function RootLayout() {
  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__header">
          <div className="shell__brand">
            <strong>Immersion AI</strong>
            <span>Чаты и подключение к LLM</span>
          </div>
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
        <div className="shell__content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
