import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../../api';
import PageState from '../../components/PageState';
import type { AccountRole, AccountStatus } from '../../format';
import type { Difficulty, Subject } from '../../types';

export type ContentStatus = 'publie' | 'brouillon' | 'masque';

export interface Account {
  id: number;
  name: string;
  initials: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  /** Groupe d'un étudiant (« BUT 2 · Groupe 1 »), matières d'un enseignant. */
  promo: string;
  lastLogin: string | null;
  createdAt: string;
}

export interface Promotion {
  id: number;
  name: string;
  year: string;
  groups: string[];
  referent: string;
}

export interface Content {
  id: number;
  title: string;
  subject: Subject;
  difficulty: Difficulty;
  points: number;
  description: string;
  status: ContentStatus;
}

export interface ReferentialCompetence {
  id: number;
  name: string;
  description: string;
  value: number;
}

export interface AuditEntry {
  id: number;
  at: string;
  text: string;
}

/** Identifiants provisoires générés par le serveur : montrés une seule fois à l'administrateur. */
export interface Credential {
  name: string;
  email: string;
  temporaryPassword: string;
}

export type AccountDraft = Pick<Account, 'name' | 'email' | 'role' | 'status' | 'promo'>;

interface Referential {
  competences: ReferentialCompetence[];
  bySubject: { subject: string; competences: string[] }[];
}

interface AdminStore {
  accounts: Account[];
  promotions: Promotion[];
  contents: Content[];
  competences: ReferentialCompetence[];
  bySubject: Referential['bySubject'];
  audit: AuditEntry[];

  createAccount: (d: AccountDraft) => Promise<Credential>;
  updateAccount: (id: number, d: AccountDraft) => Promise<void>;
  setAccountStatus: (ids: number[], status: AccountStatus) => Promise<void>;
  deleteAccounts: (ids: number[]) => Promise<void>;
  resetPasswords: (ids: number[]) => Promise<Credential[]>;

  createPromotion: (p: { name: string; year: string; groups: number; referent: string }) => Promise<void>;
  addGroup: (promoId: number) => Promise<void>;
  setReferent: (promoId: number, referent: string) => Promise<void>;
  deleteGroup: (promoId: number, group: string) => Promise<void>;
  deletePromotion: (promoId: number) => Promise<void>;

  setContentStatus: (id: number, status: ContentStatus) => Promise<void>;

  saveCompetence: (id: number | null, c: { name: string; description: string }) => Promise<void>;
  deleteCompetence: (id: number) => Promise<void>;
}

const Ctx = createContext<AdminStore | null>(null);

interface Loaded {
  accounts: Account[];
  promotions: Promotion[];
  contents: Content[];
  referential: Referential;
  audit: AuditEntry[];
}

/** Données de l'espace admin, relues depuis l'API après chaque action. */
export function AdminProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accounts, promotions, contents, referential, audit] = await Promise.all([
        api<Account[]>('/admin/accounts'),
        api<Promotion[]>('/admin/promotions'),
        api<Content[]>('/admin/contents'),
        api<Referential>('/admin/competences'),
        api<AuditEntry[]>('/admin/audit'),
      ]);
      setData({ accounts, promotions, contents, referential, audit });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const store = useMemo<AdminStore | null>(() => {
    if (!data) return null;
    const patch = (p: Partial<Loaded>) => setData((d) => (d ? { ...d, ...p } : d));
    const refreshAudit = async () => patch({ audit: await api<AuditEntry[]>('/admin/audit') });
    const refreshAccounts = async () => patch({ accounts: await api<Account[]>('/admin/accounts') });
    const send = <T,>(path: string, method: string, body?: unknown) => api<T>(path, { method, body: body ?? {} });

    const afterAccounts = async () => {
      await Promise.all([refreshAccounts(), refreshAudit()]);
    };
    const afterPromotions = async (list: Promotion[], accountsChanged = false) => {
      patch({ promotions: list });
      await Promise.all([refreshAudit(), accountsChanged ? refreshAccounts() : Promise.resolve()]);
    };
    const afterReferential = async (ref: Referential) => {
      patch({ referential: ref });
      await refreshAudit();
    };

    return {
      accounts: data.accounts,
      promotions: data.promotions,
      contents: data.contents,
      competences: data.referential.competences,
      bySubject: data.referential.bySubject,
      audit: data.audit,

      createAccount: async (d) => {
        const res = await send<{ account: Account; temporaryPassword: string }>('/admin/accounts', 'POST', d);
        await afterAccounts();
        return { name: res.account.name, email: res.account.email, temporaryPassword: res.temporaryPassword };
      },
      updateAccount: async (id, d) => {
        await send(`/admin/accounts/${id}`, 'PATCH', d);
        await afterAccounts();
      },
      setAccountStatus: async (ids, status) => {
        await send('/admin/accounts/status', 'POST', { ids, status });
        await afterAccounts();
      },
      deleteAccounts: async (ids) => {
        await send('/admin/accounts/delete', 'POST', { ids });
        await afterAccounts();
      },
      resetPasswords: async (ids) => {
        const res = await send<Credential[]>('/admin/accounts/reset-password', 'POST', { ids });
        await refreshAudit();
        return res;
      },

      createPromotion: async (p) => afterPromotions(await send<Promotion[]>('/admin/promotions', 'POST', p)),
      addGroup: async (id) => afterPromotions(await send<Promotion[]>(`/admin/promotions/${id}/groups`, 'POST')),
      setReferent: async (id, referent) => afterPromotions(await send<Promotion[]>(`/admin/promotions/${id}`, 'PATCH', { referent })),
      deleteGroup: async (id, group) =>
        afterPromotions(await send<Promotion[]>(`/admin/promotions/${id}/groups/${encodeURIComponent(group)}`, 'DELETE'), true),
      deletePromotion: async (id) => afterPromotions(await send<Promotion[]>(`/admin/promotions/${id}`, 'DELETE'), true),

      setContentStatus: async (id, status) => {
        await send(`/admin/contents/${id}`, 'PATCH', { status });
        patch({ contents: await api<Content[]>('/admin/contents') });
        await refreshAudit();
      },

      saveCompetence: async (id, c) =>
        afterReferential(await send<Referential>(id === null ? '/admin/competences' : `/admin/competences/${id}`, id === null ? 'POST' : 'PATCH', c)),
      deleteCompetence: async (id) => afterReferential(await send<Referential>(`/admin/competences/${id}`, 'DELETE')),
    };
  }, [data]);

  return (
    <PageState loading={loading && !data} error={data ? null : error} onRetry={() => void loadAll()}>
      {store && <Ctx.Provider value={store}>{children}</Ctx.Provider>}
    </PageState>
  );
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdmin doit être utilisé dans <AdminProvider>');
  return ctx;
}
