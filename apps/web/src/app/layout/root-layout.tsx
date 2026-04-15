import { Link, Outlet } from '@tanstack/react-router';

const navItems = [
  { to: '/chat', label: 'Чаты', marker: '●' },
  { to: '/server', label: 'API', marker: '◆' },
] as const;

export function RootLayout() {
  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__header">
          <div className="shell__brand">
            <strong>Immersion AI</strong>
          </div>
        </div>

        <nav className="shell__nav">
          {navItems.map((item) => (
            <Link key={item.to} activeProps={{ 'data-status': 'active' }} className="shell__link" to={item.to}>
              <span aria-hidden="true">{item.marker}</span>
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
