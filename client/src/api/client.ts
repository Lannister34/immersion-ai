/** Base HTTP client with CSRF token management */

let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/csrf-token');
  const data = (await res.json()) as { token: string };
  csrfToken = data.token;
  csrfPromise = null;
  return csrfToken;
}

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  // Deduplicate concurrent calls — reuse the same in-flight promise
  if (!csrfPromise) {
    csrfPromise = fetchCsrfToken();
  }
  return csrfPromise;
}

/** POST with FormData body (for file uploads). Skips undefined/null values. */
export async function apiPostForm(
  path: string,
  fields: Record<string, string | File | string[] | undefined | null>,
): Promise<void> {
  const token = await getCsrfToken();
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.length) form.append(key, value.join(', '));
    } else {
      form.append(key, value);
    }
  }

  const res = await fetch(path, {
    method: 'POST',
    headers: { 'x-csrf-token': token },
    body: form,
  });
  if (!res.ok) {
    let msg = `Ошибка сервера (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

/** GET request (no CSRF needed for read-only endpoints). */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    let msg = `Ошибка сервера (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getCsrfToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': token,
    },
    body: JSON.stringify(body),
  });

  // If CSRF token expired (e.g. backend restarted), refresh and retry once
  if (res.status === 403) {
    csrfToken = null;
    const newToken = await fetchCsrfToken();
    const retry = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': newToken,
      },
      body: JSON.stringify(body),
    });
    if (!retry.ok) {
      let msg = `Ошибка сервера (${retry.status})`;
      try {
        const data = (await retry.json()) as { error?: string };
        if (data?.error) msg = data.error;
      } catch {
        const text = await retry.text().catch(() => '');
        if (text) msg = text;
      }
      throw new Error(msg);
    }
    return retry.json() as Promise<T>;
  }

  if (!res.ok) {
    let msg = `Ошибка сервера (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) msg = data.error;
    } catch {
      const text = await res.text().catch(() => '');
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}
