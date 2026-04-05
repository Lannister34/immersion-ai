import type { ReactNode } from 'react';

interface SummaryCardProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function SummaryCard({ eyebrow, title, description, children }: SummaryCardProps) {
  return (
    <section className="summary-card">
      <div className="summary-card__eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {children}
    </section>
  );
}
