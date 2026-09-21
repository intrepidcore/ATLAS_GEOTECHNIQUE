/**
 * Session déverrouillée en mémoire uniquement — jamais persistée. Le mot de
 * passe n'est redemandé qu'au relancement de l'app (ou après verrouillage
 * manuel) : `data.bin` reste chiffré sur disque entre deux sessions, seule
 * cette clé dérivée vit en RAM pendant que l'app est active.
 */
import type { OperatorPayload } from './format';

interface UnlockedSession {
  packageId: string;
  operatorUserId: string;
  operatorEmail: string;
  rawArgon2Output: Uint8Array;
  payload: OperatorPayload;
  unlockedAt: string;
}

let current: UnlockedSession | null = null;
type Listener = (session: UnlockedSession | null) => void;
const listeners = new Set<Listener>();

export const atlaspackSession = {
  set(session: UnlockedSession): void {
    current = session;
    listeners.forEach((l) => l(current));
  },
  get(): UnlockedSession | null {
    return current;
  },
  isUnlocked(): boolean {
    return current !== null;
  },
  lock(): void {
    current = null;
    listeners.forEach((l) => l(current));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
