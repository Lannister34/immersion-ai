import type { ReactNode } from 'react';

interface PlaceholderScreenProps {
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  children?: ReactNode;
}

export function PlaceholderScreen({ eyebrow, title, description, bullets, children }: PlaceholderScreenProps) {
  return (
    <section className="placeholder">
      <div className="placeholder__eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
      {bullets && bullets.length > 0 ? (
        <ul>
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      {children ? <div style={{ marginTop: '20px' }}>{children}</div> : null}
    </section>
  );
}
