import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { UNAUTHORIZED_EVENT, api, getToken, setToken } from './api';

export type Role = 'etudiant' | 'enseignant' | 'admin';

/** Page d'accueil de chaque rôle après connexion. */
export const homeFor = (role: Role) => (role === 'enseignant' ? '/enseignant' : role === 'admin' ? '/admin' : '/');

interface AuthState {
  role: Role | null;
  /** Vérifie l'identifiant et le mot de passe auprès de l'API, puis renvoie le rôle du compte. */
  login: (identifiant: string, password: string) => Promise<Role>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);
const STORAGE_KEY = 'levelupjv-role';

function readRole(): Role | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!getToken()) return null;
    return v === 'etudiant' || v === 'enseignant' || v === 'admin' ? v : null;
  } catch {
    return null;
  }
}

function saveRole(role: Role | null) {
  try {
    if (role) localStorage.setItem(STORAGE_KEY, role);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible : on garde l'état en mémoire */
  }
}

/** Authentification réelle : le jeton JWT renvoyé par l'API est conservé dans le navigateur. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(readRole);

  const logout = () => {
    setToken(null);
    saveRole(null);
    setRole(null);
  };

  const login = async (identifiant: string, password: string) => {
    const res = await api<{ token: string; role: Role }>('/auth/login', { body: { identifiant, password } });
    setToken(res.token);
    saveRole(res.role);
    setRole(res.role);
    return res.role;
  };

  // Jeton expiré ou refusé par l'API : retour à la connexion.
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      saveRole(null);
      setRole(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  return <AuthContext.Provider value={{ role, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
