import { createContext, useContext, type ReactNode } from 'react';
import { useApi } from './api';
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
  return <MeContext.Provider value={{ me: data, refreshMe: () => void reload() }}>{children}</MeContext.Provider>;
}

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMe doit être utilisé dans <MeProvider>');
  return ctx;
}
