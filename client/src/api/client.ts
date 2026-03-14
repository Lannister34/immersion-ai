/** Base HTTP client with CSRF token management */

let csrfToken: string | null = null;

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/csrf-token');
  const data = await res.json() as { token: string };
  csrfToken = data.token;
  return csrfToken;
}

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  return fetchCsrfToken();
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
        const data = await retry.json() as { error?: string };
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
      const data = await res.json() as { error?: string };
      if (data?.error) msg = data.error;
    } catch {
      const text = await res.text().catch(() => '');
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}
