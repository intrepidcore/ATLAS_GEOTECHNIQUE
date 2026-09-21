import { useEffect, useState } from 'react';
import { atlaspackSession } from '@/services/atlaspack/session';

/** Réactivité React sur la session .atlaspack (module singleton non-React,
 * partagé aussi par les services hors composants — cf. session.ts). */
export function useAtlasPackUnlocked(): boolean {
  const [unlocked, setUnlocked] = useState(atlaspackSession.isUnlocked());
  useEffect(() => atlaspackSession.subscribe((s) => setUnlocked(s !== null)), []);
  return unlocked;
}
