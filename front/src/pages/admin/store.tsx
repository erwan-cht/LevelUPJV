import { createContext, useContext, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { catalog } from '../../data/catalog';
import {
  initialAccounts,
  initialAudit,
  initialCompetences,
  initialPromotions,
  type Account,
  type AuditEntry,
  type Promotion,
} from '../../data/admin';
import type { Competence } from '../../types';

export type ContentStatus = 'publie' | 'brouillon' | 'masque';

interface AdminStore {
  accounts: Account[];
  setAccounts: Dispatch<SetStateAction<Account[]>>;
  promotions: Promotion[];
  setPromotions: Dispatch<SetStateAction<Promotion[]>>;
  competences: Competence[];
  setCompetences: Dispatch<SetStateAction<Competence[]>>;
  contentStatus: Record<number, ContentStatus>;
  setContentStatus: Dispatch<SetStateAction<Record<number, ContentStatus>>>;
  audit: AuditEntry[];
  /** Ajoute une ligne au journal d'administration. */
  log: (text: string) => void;
}

const Ctx = createContext<AdminStore | null>(null);

const now = () =>
  `Aujourd’hui, ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

/**
 * Données de l'espace admin, partagées entre ses pages.
 * Factices et en mémoire : remplacées plus tard par l'API (Express + Prisma).
 */
export function AdminProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [promotions, setPromotions] = useState(initialPromotions);
  const [competences, setCompetences] = useState(initialCompetences);
  const [contentStatus, setContentStatus] = useState<Record<number, ContentStatus>>(() =>
    Object.fromEntries(catalog.map((c, i) => [c.id, i % 9 === 4 ? 'brouillon' : 'publie'])),
  );
  const [audit, setAudit] = useState(initialAudit);
  const nextId = useRef(initialAudit.length + 1);

  const log = (text: string) => setAudit((a) => [{ id: nextId.current++, at: now(), text }, ...a].slice(0, 30));

  return (
    <Ctx.Provider
      value={{ accounts, setAccounts, promotions, setPromotions, competences, setCompetences, contentStatus, setContentStatus, audit, log }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdmin doit être utilisé dans <AdminProvider>');
  return ctx;
}
