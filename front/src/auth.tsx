import { createContext, useContext, useState, type ReactNode } from 'react';

export type Role = 'etudiant' | 'enseignant' | 'admin';

/** Page d'accueil de chaque rôle après connexion. */
export const homeFor = (role: Role) => (role === 'enseignant' ? '/enseignant' : role === 'admin' ? '/admin' : '/');

interface AuthState {
  role: Role | null;
  login: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = 'levelupjv-role';

function readRole(): Role | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'etudiant' || v === 'enseignant' || v === 'admin' ? v : null;
  } catch {
    return null;
  }
}

/** Connexion factice : aucune vérification, on mémorise juste le rôle choisi. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(readRole);

  const login = (r: Role) => {
    try {
      localStorage.setItem(STORAGE_KEY, r);
    } catch {
      /* stockage indisponible : on garde l'état en mémoire */
    }
    setRole(r);
  };
  const logout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* idem */
    }
    setRole(null);
  };

  return <AuthContext.Provider value={{ role, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
