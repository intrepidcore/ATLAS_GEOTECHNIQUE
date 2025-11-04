/**
 * HTTP wrapper avec timeout et AbortController
 * v2.5.0 - Phase UI-01
 */

export class HttpError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
    this.name = 'HttpError';
  }
}

export function httpJSON<T>(
  input: RequestInfo,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 15000);

  return fetch(input, {
    ...init,
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
    .then(async (r) => {
      clearTimeout(timeout);
      const contentType = r.headers.get('content-type');
      const data = contentType?.includes('application/json')
        ? await r.json()
        : await r.text();

      if (!r.ok) {
        const message =
          typeof data === 'string'
            ? data
            : data?.message || `HTTP ${r.status}`;
        throw new HttpError(r.status, message);
      }

      return data as T;
    })
    .catch((err) => {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new HttpError(0, 'Request timeout');
      }
      throw err;
    });
}
