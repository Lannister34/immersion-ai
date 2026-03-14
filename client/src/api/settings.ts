import { apiPost } from './client';

// ── User Settings (server-side persistence) ──────────────────────────────────

export async function getUserSettings(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('/api/user-settings');
    if (!res.ok) return null;
    const json = await res.json() as { ok: boolean; data: Record<string, unknown> | null };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function saveUserSettings(data: Record<string, unknown>): Promise<void> {
  await apiPost('/api/user-settings', data);
}

// ── App Settings ─────────────────────────────────────────────────────────────

interface SettingsResponse {
  settings: string; // raw JSON string
  textgenerationwebui_preset_names: string[];
  [key: string]: unknown;
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const data = await apiPost<SettingsResponse>('/api/settings/get', {});
  try {
    return JSON.parse(data.settings) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function getTextGenPresets(): Promise<string[]> {
  const data = await apiPost<SettingsResponse>('/api/settings/get', {});
  return data.textgenerationwebui_preset_names ?? [];
}

// ── Preset Loading ───────────────────────────────────────────────────────────

export interface TextGenPresetData {
  name: string;
  temp: number;
  top_p: number;
  top_k: number;
  min_p: number;
  rep_pen: number;
  rep_pen_range: number;
  [key: string]: unknown;
}

export async function getTextGenPresetsWithData(): Promise<TextGenPresetData[]> {
  const data = await apiPost<{
    textgenerationwebui_presets: string[];
    textgenerationwebui_preset_names: string[];
  }>('/api/settings/get', {});
  const names = data.textgenerationwebui_preset_names ?? [];
  const contents = data.textgenerationwebui_presets ?? [];
  return names.map((name, i) => {
    const parsed = typeof contents[i] === 'string'
      ? JSON.parse(contents[i]) as TextGenPresetData
      : (contents[i] as unknown as TextGenPresetData);
    return { ...parsed, name };
  });
}
