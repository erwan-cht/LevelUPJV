import { useState, type FormEvent } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { promoKey } from '../../format';
import { Breadcrumb, PageTitle, buttonBrand, buttonOutline, buttonPrimary, inputClass } from '../../components/ui';
import { useAdmin, type Promotion } from './store';
import { ConfirmDialog, Field, Modal, StatCard, useToast } from './ui';

export default function Promotions() {
  const { promotions, accounts, createPromotion, addGroup, setReferent, deleteGroup, deletePromotion } = useAdmin();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<{ promo: Promotion; group?: string } | null>(null);

  const teachers = accounts.filter((a) => a.role === 'enseignant').map((a) => a.name);
  const studentsIn = (key: string) => accounts.filter((a) => a.role === 'etudiant' && a.promo === key).length;
  const studentsInPromo = (p: Promotion) => p.groups.reduce((n, g) => n + studentsIn(promoKey(p.name, g)), 0);
  const unassigned = accounts.filter(
    (a) => a.role === 'etudiant' && !promotions.some((p) => p.groups.some((g) => promoKey(p.name, g) === a.promo)),
  ).length;

  /** Exécute une action de l'API et annonce le résultat (ou l'erreur renvoyée par le serveur). */
  const run = async (action: () => Promise<void>, done: string) => {
    try {
      await action();
      toast.show(done);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Action impossible.');
    }
  };

  const remove = ({ promo, group }: { promo: Promotion; group?: string }) =>
    group
      ? run(() => deleteGroup(promo.id, group), `${group} supprimé`)
      : run(() => deletePromotion(promo.id), `${promo.name} supprimée`);

  const pendingCount = toDelete
    ? toDelete.group
      ? studentsIn(promoKey(toDelete.promo.name, toDelete.group))
      : studentsInPromo(toDelete.promo)
    : 0;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Administration', to: '/admin' }, { label: 'Promotions' }]} />

      <PageTitle title="Promotions et groupes" subtitle="Organiser les étudiants par promotion et par groupe de TD.">
        <button onClick={() => setCreating(true)} className={buttonBrand}>
          <Plus className="h-4 w-4" /> Nouvelle promotion
        </button>
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Promotions" value={promotions.length} border="border-t-navy" />
        <StatCard label="Groupes" value={promotions.reduce((n, p) => n + p.groups.length, 0)} border="border-t-brand" />
        <StatCard label="Étudiants sans groupe" value={unassigned} hint={unassigned ? 'à rattacher depuis Comptes' : 'tout le monde est rattaché'} border="border-t-red-600" />
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {promotions.map((p) => (
          <section key={p.id} className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-start justify-between gap-2 bg-navy px-4 py-3 text-white">
              <div>
                <h2 className="font-semibold">{p.name}</h2>
                <p className="text-[11px] text-slate-300">{p.year} · {studentsInPromo(p)} étudiant{studentsInPromo(p) > 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setToDelete({ promo: p })} aria-label={`Supprimer ${p.name}`} className="rounded p-1 hover:bg-white/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 p-4">
              <label className="block text-xs font-medium">
                Enseignant référent
                <select
                  className={`${inputClass} mt-1`}
                  value={p.referent}
                  onChange={(e) => run(() => setReferent(p.id, e.target.value), `Référent de ${p.name} : ${e.target.value}`)}
                >
                  {!teachers.includes(p.referent) && <option>{p.referent || '—'}</option>}
                  {teachers.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>

              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {p.groups.map((g) => {
                  const n = studentsIn(promoKey(p.name, g));
                  return (
                    <li key={g} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <Users className="h-4 w-4 text-muted" />
                      <span className="flex-1 font-medium">{g}</span>
                      <span className="text-xs text-muted">{n} étudiant{n > 1 ? 's' : ''}</span>
                      <button onClick={() => setToDelete({ promo: p, group: g })} aria-label={`Supprimer ${g} de ${p.name}`} className="rounded p-1 text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
                {p.groups.length === 0 && <li className="px-3 py-3 text-xs text-muted">Aucun groupe.</li>}
              </ul>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs">
              <button onClick={() => run(() => addGroup(p.id), `Groupe ajouté à ${p.name}`)} className="font-semibold text-brand hover:underline">+ Ajouter un groupe</button>
              <Link to="/admin" className="text-muted hover:text-navy">Voir les comptes →</Link>
            </div>
          </section>
        ))}
        {promotions.length === 0 && <p className="rounded-lg bg-panel p-6 text-center text-sm text-muted md:col-span-2 lg:col-span-3">Aucune promotion pour le moment.</p>}
      </div>

      {creating && (
        <PromoForm
          teachers={teachers}
          onSave={async (p) => {
            try {
              await createPromotion(p);
              toast.show(`${p.name} créée`);
              setCreating(false);
              return null;
            } catch (e) {
              return e instanceof Error ? e.message : 'Création impossible.';
            }
          }}
          onClose={() => setCreating(false)}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title={toDelete.group ? `Supprimer ${toDelete.group} ?` : `Supprimer ${toDelete.promo.name} ?`}
          message={
            pendingCount > 0
              ? `${pendingCount} étudiant${pendingCount > 1 ? 's' : ''} ser${pendingCount > 1 ? 'ont' : 'a'} détaché${pendingCount > 1 ? 's' : ''} et passer${pendingCount > 1 ? 'ont' : 'a'} « Sans groupe ». Leurs comptes ne sont pas supprimés.`
              : 'Aucun étudiant n’est rattaché, la suppression est sans conséquence.'
          }
          confirmLabel="Supprimer"
          danger
          onConfirm={() => remove(toDelete)}
          onClose={() => setToDelete(null)}
        />
      )}

      {toast.node}
    </div>
  );
}

function PromoForm({
  teachers,
  onSave,
  onClose,
}: {
  teachers: string[];
  onSave: (p: { name: string; year: string; groups: number; referent: string }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [year, setYear] = useState('2026-2027');
  const [groups, setGroups] = useState(3);
  const [referent, setReferent] = useState(teachers[0] ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Donne un nom à la promotion.');
    setBusy(true);
    const server = await onSave({ name: n, year, groups, referent });
    setBusy(false);
    if (server) setError(server);
  };

  return (
    <Modal title="Nouvelle promotion" onClose={onClose} width="max-w-md">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nom" error={error}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="LP Développement web" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Année universitaire">
            <select className={inputClass} value={year} onChange={(e) => setYear(e.target.value)}>
              {['2026-2027', '2027-2028'].map((y) => <option key={y}>{y}</option>)}
            </select>
          </Field>
          <Field label="Nombre de groupes">
            <input className={inputClass} type="number" min={1} max={8} value={groups} onChange={(e) => setGroups(Math.min(8, Math.max(1, Number(e.target.value) || 1)))} />
          </Field>
        </div>
        <Field label="Enseignant référent">
          <select className={inputClass} value={referent} onChange={(e) => setReferent(e.target.value)}>
            {teachers.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={buttonOutline}>Annuler</button>
          <button type="submit" disabled={busy} className={buttonPrimary}>Créer</button>
        </div>
      </form>
    </Modal>
  );
}
