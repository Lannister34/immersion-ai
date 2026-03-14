// ── Date formatting utilities ────────────────────────────────────────────────

import { i18n } from '@/i18n';

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US' };

function getLocale(): string {
  return LOCALE_MAP[i18n.language] ?? 'ru-RU';
}

export function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(getLocale(), {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return i18n.t('time.justNow');
    if (diffMins < 60) return i18n.t('time.minutesAgo', { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return i18n.t('time.hoursAgo', { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return i18n.t('time.daysAgo', { count: diffDays });
    return d.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
