import type { SyntheticEvent } from 'react';

/** Hide the <img> element when its source fails to load (e.g. deleted avatar). */
export function hideOnImageError(e: SyntheticEvent<HTMLImageElement>): void {
  e.currentTarget.style.display = 'none';
}
