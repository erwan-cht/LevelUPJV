import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApi } from './api';
import LevelUp from './fx/LevelUp';
import type { ApiUser } from './types';

interface MeState {
  me: ApiUser | null;
  /** À appeler après une action qui change les points (défi réussi, indice acheté). */
  refreshMe: () => void;
}

const MeContext = createContext<MeState | null>(null);

/** Charge l'étudiant connecté une fois pour toutes les pages de l'espace étudiant. */
export function MeProvider({ children }: { children: ReactNode }) {
  const { data, reload } = useApi<ApiUser>('/me');

  // Passage de niveau : la mascotte fête ça (pas au premier chargement, seulement quand le niveau monte).
  const lastLevel = useRef<number | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  useEffect(() => {
    if (!data) return;
    if (lastLevel.current !== null && data.level > lastLevel.current) setLevelUp(data.level);
    lastLevel.current = data.level;
  }, [data]);

  return (
    <MeContext.Provider value={{ me: data, refreshMe: () => void reload() }}>
      {children}
      {levelUp !== null && <LevelUp level={levelUp} onClose={() => setLevelUp(null)} />}
    </MeContext.Provider>
  );
}

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMe doit être utilisé dans <MeProvider>');
  return ctx;
}
