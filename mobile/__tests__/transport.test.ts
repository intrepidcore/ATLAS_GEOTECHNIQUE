import { fetchWithTimeout } from '@/api/transport';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('interrompt une requête Tailscale suspendue et renvoie un diagnostic', async () => {
    global.fetch = jest.fn((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;

    const request = fetchWithTimeout('http://100.122.10.70:8000/api/health', {}, 100);
    jest.advanceTimersByTime(100);

    await expect(request).rejects.toThrow('Délai réseau dépassé');
  });
});
