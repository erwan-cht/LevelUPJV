import { useMemo, useState, type FormEvent } from 'react';
import { Check, Download, KeyRound, Pencil, Search, ShieldOff, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import {
  emailOf,
  initialsOf,
  promoKey,
  roleLabel,
  statusLabel,
  type Account,
  type AccountRole,
  type AccountStatus,
} from '../../data/admin';
import { Avatar, Breadcrumb, PageTitle, buttonBrand, buttonOutline, buttonPrimary, inputClass } from '../../components/ui';
import { useAdmin } from './store';
import { AuditLog, ConfirmDialog, Field, Modal, RoleBadge, StatCard, StatusBadge, selectClass, useToast } from './ui';

const PAGE_SIZE = 10;
const NO_GROUP = 'Sans groupe';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Draft = Omit<Account, 'id' | 'initials' | 'lastLogin' | 'createdAt'>;
type Confirm = { kind: 'delete' | 'reset'; ids: number[] } | null;

export default function Comptes() {
  const { accounts, setAccounts, promotions, log } = useAdmin();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [role, setRole] = useState<'tous' | AccountRole>('tous');
  const [status, setStatus] = useState<'tous' | AccountStatus>('tous');
  const [promo, setPromo] = useState('toutes');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const promoOptions = useMemo(
    () => [...promotions.flatMap((p) => p.groups.map((g) => promoKey(p.name, g))), NO_GROUP],
    [promotions],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter(
      (a) =>
        (!q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)) &&
        (role === 'tous' || a.role === role) &&
        (status === 'tous' || a.status === status) &&
        (promo === 'toutes' || a.promo === promo),
    );
  }, [accounts, query, role, status, promo]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const count = (pred: (a: Account) => boolean) => accounts.filter(pred).length;
  const nameOf = (id: number) => accounts.find((a) => a.id === id)?.name ?? '';
  const describe = (ids: number[]) => (ids.length === 1 ? nameOf(ids[0]) : `${ids.length} comptes`);

  const resetFilters = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      rows.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id)));
      return n;
    });

  const setStatusOf = (ids: number[], next: AccountStatus) => {
    setAccounts((list) => list.map((a) => (ids.includes(a.id) ? { ...a, status: next } : a)));
    const verb = next === 'suspendu' ? 'suspendu' : next === 'actif' ? 'activé' : 'mis en attente';
    log(`${ids.length === 1 ? 'Compte de ' : ''}${describe(ids)} ${verb}${ids.length > 1 && next !== 'en-attente' ? 's' : ''}`);
    toast.show(`${describe(ids)} : ${statusLabel[next].toLowerCase()}`);
    setSelected(new Set());
  };

  const remove = (ids: number[]) => {
    const label = describe(ids);
    setAccounts((list) => list.filter((a) => !ids.includes(a.id)));
    log(`${ids.length === 1 ? 'Compte de ' : ''}${label} supprimé${ids.length > 1 ? 's' : ''}`);
    toast.show(`${label} supprimé${ids.length > 1 ? 's' : ''}`);
    setSelected(new Set());
  };

  const resetPassword = (ids: number[]) => {
    log(`Réinitialisation du mot de passe envoyée à ${describe(ids)}`);
    toast.show(`Lien de réinitialisation envoyé à ${describe(ids)}`);
    setSelected(new Set());
  };

  const save = (draft: Draft) => {
    if (editing === 'new') {
      const id = Math.max(0, ...accounts.map((a) => a.id)) + 1;
      const today = new Date().toLocaleDateString('fr-FR');
      setAccounts((list) => [
        { ...draft, id, initials: initialsOf(draft.name), lastLogin: 'Jamais', createdAt: today },
        ...list,
      ]);
      log(`Compte de ${draft.name} créé (${roleLabel[draft.role].toLowerCase()})`);
      toast.show(`Compte de ${draft.name} créé, invitation envoyée`);
    } else if (editing) {
      setAccounts((list) =>
        list.map((a) => (a.id === editing.id ? { ...a, ...draft, initials: initialsOf(draft.name) } : a)),
      );
      if (editing.role !== draft.role) log(`Rôle de ${draft.name} : ${roleLabel[editing.role]} → ${roleLabel[draft.role]}`);
      else log(`Compte de ${draft.name} modifié`);
      toast.show(`Compte de ${draft.name} enregistré`);
    }
    setEditing(null);
  };

  const exportCsv = () => {
    const head = ['Nom', 'E-mail', 'Rôle', 'Promotion', 'Statut', 'Dernière connexion', 'Créé le'];
    const lines = filtered.map((a) =>
      [a.name, a.email, roleLabel[a.role], a.promo, statusLabel[a.status], a.lastLogin, a.createdAt]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(';'),
    );
    const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'comptes-levelupjv.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.show(`${filtered.length} comptes exportés`);
  };

  const sel = [...selected];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Administration', to: '/admin' }, { label: 'Comptes' }]} />

      <PageTitle title="Gestion des comptes" subtitle="Créer, modifier, suspendre ou supprimer les comptes de la plateforme.">
        <div className="flex gap-2">
          <button onClick={exportCsv} className={buttonOutline}>
            <Download className="h-4 w-4" /> Exporter
          </button>
          <button onClick={() => setEditing('new')} className={buttonBrand}>
            <UserPlus className="h-4 w-4" /> Nouveau compte
          </button>
        </div>
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Comptes" value={accounts.length} hint={`${count((a) => a.status === 'actif')} actifs`} border="border-t-navy" />
        <StatCard label="Étudiants" value={count((a) => a.role === 'etudiant')} hint={`${promotions.length} promotions`} border="border-t-brand" />
        <StatCard label="Enseignants & admins" value={count((a) => a.role !== 'etudiant')} border="border-t-sky-600" />
        <StatCard
          label="À traiter"
          value={count((a) => a.status !== 'actif')}
          hint={`${count((a) => a.status === 'en-attente')} en attente · ${count((a) => a.status === 'suspendu')} suspendu${count((a) => a.status === 'suspendu') > 1 ? 's' : ''}`}
          border="border-t-red-600"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
            <label className="relative min-w-48 flex-1">
              <span className="sr-only">Rechercher</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className={`${inputClass} pl-9`}
                placeholder="Nom ou e-mail…"
                value={query}
                onChange={(e) => resetFilters(() => setQuery(e.target.value))}
              />
            </label>
            <select aria-label="Rôle" className={selectClass} value={role} onChange={(e) => resetFilters(() => setRole(e.target.value as typeof role))}>
              <option value="tous">Tous les rôles</option>
              {(Object.keys(roleLabel) as AccountRole[]).map((r) => (
                <option key={r} value={r}>{roleLabel[r]}</option>
              ))}
            </select>
            <select aria-label="Statut" className={selectClass} value={status} onChange={(e) => resetFilters(() => setStatus(e.target.value as typeof status))}>
              <option value="tous">Tous les statuts</option>
              {(Object.keys(statusLabel) as AccountStatus[]).map((s) => (
                <option key={s} value={s}>{statusLabel[s]}</option>
              ))}
            </select>
            <select aria-label="Promotion" className={selectClass} value={promo} onChange={(e) => resetFilters(() => setPromo(e.target.value))}>
              <option value="toutes">Toutes les promos</option>
              {promoOptions.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>

          {sel.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-brand-light px-3 py-2 text-xs">
              <span className="font-semibold">{sel.length} sélectionné{sel.length > 1 ? 's' : ''}</span>
              <span className="flex-1" />
              <button onClick={() => setStatusOf(sel, 'actif')} className="rounded border border-navy bg-white px-2.5 py-1 font-medium hover:bg-slate-50">Activer</button>
              <button onClick={() => setStatusOf(sel, 'suspendu')} className="rounded border border-navy bg-white px-2.5 py-1 font-medium hover:bg-slate-50">Suspendre</button>
              <button onClick={() => setConfirm({ kind: 'reset', ids: sel })} className="rounded border border-navy bg-white px-2.5 py-1 font-medium hover:bg-slate-50">Réinitialiser le mot de passe</button>
              <button onClick={() => setConfirm({ kind: 'delete', ids: sel })} className="rounded bg-red-600 px-2.5 py-1 font-medium text-white hover:bg-red-700">Supprimer</button>
              <button onClick={() => setSelected(new Set())} className="px-1 text-muted hover:text-navy">Annuler</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-panel text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input type="checkbox" aria-label="Tout sélectionner sur la page" checked={allOnPage} onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2 font-semibold">Utilisateur</th>
                  <th className="px-3 py-2 font-semibold">Rôle</th>
                  <th className="px-3 py-2 font-semibold">Promo / matières</th>
                  <th className="px-3 py-2 font-semibold">Statut</th>
                  <th className="px-3 py-2 font-semibold">Dernière connexion</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((a) => (
                  <tr key={a.id} className={selected.has(a.id) ? 'bg-brand-light/50' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" aria-label={`Sélectionner ${a.name}`} checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={a.initials} size="h-8 w-8 text-xs" color={a.role === 'admin' ? 'bg-brand' : a.role === 'enseignant' ? 'bg-sky-600' : 'bg-navy'} />
                        <div className="min-w-0">
                          <p className="font-semibold">{a.name}</p>
                          <p className="truncate text-[11px] text-muted">{a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5"><RoleBadge role={a.role} /></td>
                    <td className="px-3 py-2.5 text-xs">{a.promo}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                    <td className="px-3 py-2.5 text-xs text-muted">{a.lastLogin}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-0.5">
                        {a.status === 'en-attente' ? (
                          <IconButton label={`Valider ${a.name}`} onClick={() => setStatusOf([a.id], 'actif')}><Check className="h-4 w-4 text-green-600" /></IconButton>
                        ) : a.status === 'actif' ? (
                          <IconButton label={`Suspendre ${a.name}`} onClick={() => setStatusOf([a.id], 'suspendu')}><ShieldOff className="h-4 w-4" /></IconButton>
                        ) : (
                          <IconButton label={`Réactiver ${a.name}`} onClick={() => setStatusOf([a.id], 'actif')}><ShieldCheck className="h-4 w-4 text-green-600" /></IconButton>
                        )}
                        <IconButton label={`Réinitialiser le mot de passe de ${a.name}`} onClick={() => setConfirm({ kind: 'reset', ids: [a.id] })}><KeyRound className="h-4 w-4" /></IconButton>
                        <IconButton label={`Modifier ${a.name}`} onClick={() => setEditing(a)}><Pencil className="h-4 w-4" /></IconButton>
                        <IconButton label={`Supprimer ${a.name}`} onClick={() => setConfirm({ kind: 'delete', ids: [a.id] })}><Trash2 className="h-4 w-4 text-red-600" /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted">Aucun compte ne correspond à ces filtres.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-muted">
            <span>
              {filtered.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} sur {filtered.length} comptes
            </span>
            <div className="flex items-center gap-1">
              <button disabled={current === 1} onClick={() => setPage(current - 1)} className="rounded border border-slate-300 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40">Précédent</button>
              <span className="px-2">Page {current} / {pages}</span>
              <button disabled={current === pages} onClick={() => setPage(current + 1)} className="rounded border border-slate-300 px-2.5 py-1 hover:bg-slate-50 disabled:opacity-40">Suivant</button>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <PendingCard accounts={accounts} onValidate={(ids) => setStatusOf(ids, 'actif')} />
          <AuditLog />
        </aside>
      </div>

      {editing && (
        <AccountForm
          account={editing === 'new' ? null : editing}
          promoOptions={promoOptions}
          emailTaken={(email, id) => accounts.some((a) => a.email.toLowerCase() === email.toLowerCase() && a.id !== id)}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

      {confirm?.kind === 'delete' && (
        <ConfirmDialog
          title="Supprimer définitivement ?"
          message={<>Le compte de <strong className="text-navy">{describe(confirm.ids)}</strong> et son historique (points, défis, badges) seront supprimés. Cette action est irréversible.</>}
          confirmLabel="Supprimer"
          danger
          onConfirm={() => remove(confirm.ids)}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === 'reset' && (
        <ConfirmDialog
          title="Réinitialiser le mot de passe"
          message={<>Un e-mail avec un lien de réinitialisation sera envoyé à <strong className="text-navy">{describe(confirm.ids)}</strong>. L’ancien mot de passe ne fonctionnera plus.</>}
          confirmLabel="Envoyer le lien"
          onConfirm={() => resetPassword(confirm.ids)}
          onClose={() => setConfirm(null)}
        />
      )}

      {toast.node}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="rounded p-1.5 text-navy hover:bg-panel">
      {children}
    </button>
  );
}

function PendingCard({ accounts, onValidate }: { accounts: Account[]; onValidate: (ids: number[]) => void }) {
  const pending = accounts.filter((a) => a.status === 'en-attente');
  return (
    <section className="overflow-hidden rounded-lg border border-brand bg-white">
      <div className="flex items-center justify-between bg-brand px-4 py-2 text-white">
        <h2 className="text-xs font-semibold uppercase tracking-wide">Comptes en attente</h2>
        <span className="text-[11px]">{pending.length}</span>
      </div>
      {pending.length === 0 ? (
        <p className="p-4 text-xs text-muted">Aucune demande à valider.</p>
      ) : (
        <>
          <ul className="space-y-1 p-3">
            {pending.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-md px-2 py-1.5">
                <Avatar initials={a.initials} size="h-8 w-8 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="text-[11px] text-muted">{a.promo} · créé le {a.createdAt}</p>
                </div>
                <button onClick={() => onValidate([a.id])} className="rounded border border-navy px-2 py-1 text-[11px] font-medium hover:bg-slate-50">Valider</button>
              </li>
            ))}
          </ul>
          {pending.length > 1 && (
            <button onClick={() => onValidate(pending.map((a) => a.id))} className="m-3 mt-0 text-xs font-semibold text-brand hover:underline">
              Tout valider →
            </button>
          )}
        </>
      )}
    </section>
  );
}

function AccountForm({
  account,
  promoOptions,
  emailTaken,
  onSave,
  onClose,
}: {
  account: Account | null;
  promoOptions: string[];
  emailTaken: (email: string, id?: number) => boolean;
  onSave: (d: Draft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(
    account
      ? { name: account.name, email: account.email, role: account.role, status: account.status, promo: account.promo }
      : { name: '', email: '', role: 'etudiant', status: 'en-attente', promo: promoOptions[0] ?? '' },
  );
  const [emailTouched, setEmailTouched] = useState(Boolean(account));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    if (draft.name.trim().split(/\s+/).length < 2) err.name = 'Indique le prénom et le nom.';
    if (!EMAIL_RE.test(draft.email)) err.email = 'Adresse e-mail invalide.';
    else if (emailTaken(draft.email, account?.id)) err.email = 'Cette adresse est déjà utilisée par un autre compte.';
    if (draft.role === 'etudiant' && !draft.promo) err.promo = 'Choisis une promotion.';
    setErrors(err);
    if (Object.keys(err).length) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      email: draft.email.trim(),
      promo: draft.role === 'admin' ? '—' : draft.promo.trim() || '—',
    });
  };

  return (
    <Modal title={account ? `Modifier le compte de ${account.name}` : 'Nouveau compte'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Prénom et nom" error={errors.name}>
          <input
            className={inputClass}
            value={draft.name}
            onChange={(e) => {
              set('name', e.target.value);
              if (!emailTouched && draft.role === 'etudiant') set('email', e.target.value.trim() ? emailOf(e.target.value) : '');
            }}
            placeholder="Alice Vasseur"
          />
        </Field>
        <Field label="E-mail universitaire" error={errors.email}>
          <input
            className={inputClass}
            type="email"
            value={draft.email}
            onChange={(e) => {
              setEmailTouched(true);
              set('email', e.target.value);
            }}
            placeholder="prenom.nom@etud.u-picardie.fr"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Rôle">
            <select
              className={inputClass}
              value={draft.role}
              onChange={(e) => {
                const r = e.target.value as AccountRole;
                setDraft((d) => ({
                  ...d,
                  role: r,
                  promo: r === 'etudiant' ? (promoOptions.includes(d.promo) ? d.promo : promoOptions[0] ?? '') : r === 'enseignant' && (promoOptions.includes(d.promo) || d.promo === '—') ? '' : d.promo,
                }));
              }}
            >
              {(Object.keys(roleLabel) as AccountRole[]).map((r) => (
                <option key={r} value={r}>{roleLabel[r]}</option>
              ))}
            </select>
          </Field>
          <Field label="Statut">
            <select className={inputClass} value={draft.status} onChange={(e) => set('status', e.target.value as AccountStatus)}>
              {(Object.keys(statusLabel) as AccountStatus[]).map((s) => (
                <option key={s} value={s}>{statusLabel[s]}</option>
              ))}
            </select>
          </Field>
        </div>

        {draft.role === 'etudiant' && (
          <Field label="Promotion et groupe" error={errors.promo}>
            <select className={inputClass} value={draft.promo} onChange={(e) => set('promo', e.target.value)}>
              {promoOptions.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
        )}
        {draft.role === 'enseignant' && (
          <Field label="Matières enseignées">
            <input className={inputClass} value={draft.promo} onChange={(e) => set('promo', e.target.value)} placeholder="Bases de données, Web" />
          </Field>
        )}
        {draft.role === 'admin' && (
          <p className="rounded-md bg-brand-light px-3 py-2 text-xs">Un administrateur a accès à tous les comptes, contenus et au référentiel.</p>
        )}

        {!account && <p className="text-xs text-muted">Un e-mail d’invitation sera envoyé pour définir le mot de passe.</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={buttonOutline}>Annuler</button>
          <button type="submit" className={buttonPrimary}>{account ? 'Enregistrer' : 'Créer le compte'}</button>
        </div>
      </form>
    </Modal>
  );
}
