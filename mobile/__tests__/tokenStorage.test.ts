jest.mock('expo-secure-store', () => {
  const mockStore = new Map<string, string>();
  return {
    __mockStore: mockStore,
    getItemAsync: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      mockStore.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      mockStore.delete(key);
      return Promise.resolve();
    }),
  };
});

import { tokenStorage } from '@/api/tokenStorage';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const secureStoreMock = require('expo-secure-store') as { __mockStore: Map<string, string> };

describe('tokenStorage', () => {
  beforeEach(() => secureStoreMock.__mockStore.clear());

  it('returns null when nothing was stored', async () => {
    expect(await tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });

  it('persists and returns both tokens after set()', async () => {
    await tokenStorage.set('access-1', 'refresh-1');
    expect(await tokenStorage.getAccessToken()).toBe('access-1');
    expect(await tokenStorage.getRefreshToken()).toBe('refresh-1');
  });

  it('clears both tokens', async () => {
    await tokenStorage.set('access-1', 'refresh-1');
    await tokenStorage.clear();
    expect(await tokenStorage.getAccessToken()).toBeNull();
    expect(await tokenStorage.getRefreshToken()).toBeNull();
  });
});
