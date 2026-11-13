import { useState, type FormEvent } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { promoKey, type Promotion } from '../../data/admin';
import { Breadcrumb, PageTitle, buttonBrand, buttonOutline, buttonPrimary, inputClass } from '../../components/ui';
import { useAdmin } from './store';
import { ConfirmDialog, Field, Modal, StatCard, useToast } from './ui';

export default function Promotions() {
  const { promotions, setPromotions, accounts, setAccounts, log } = useAdmin();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<{ promo: Promotion; group?: string } | null>(null);

  const teachers = accounts.filter((a) => a.role === 'enseignant').map((a) => a.name);
  const studentsIn = (key: string) => accounts.filter((a) => a.role === 'etudiant' && a.promo === key).length;
  const studentsInPromo = (p: Promotion) => p.groups.reduce((n, g) => n + studentsIn(promoKey(p.name, g)), 0);
  const unassigned = accounts.filter(
    (a) => a.role === 'etudiant' && !promotions.some((p) => p.groups.some((g) => promoKey(p.name, g) === a.promo)),
  ).length;

  const addGroup = (p: Promotion) => {
    let i = 1;
    while (p.groups.includes(`Groupe ${i}`)) i++;
    const name = `Groupe ${i}`;
    setPromotions((list) => list.map((x) => (x.id === p.id ? { ...x, groups: [...x.groups, name] } : x)));
    log(`${name} ajouté à ${p.name}`);
    toast.show(`${name} ajouté à ${p.name}`);
  };

  const setReferent = (p: Promotion, referent: string) => {
    setPromotions((list) => list.map((x) => (x.id === p.id ? { ...x, referent } : x)));
    log(`Référent de ${p.name} : ${referent}`);
  };

  /** Les étudiants d'un groupe ou d'une promo supprimés passent « sans groupe ». */
  const unassign = (keys: string[]) =>
    setAccounts((list) => list.map((a) => (a.role === 'etudiant' && keys.includes(a.promo) ? { ...a, promo: 'Sans groupe' } : a)));

  const remove = ({ promo, group }: { promo: Promotion; group?: string }) => {
    if (group) {
      unassign([promoKey(promo.name, group)]);
      setPromotions((list) => list.map((x) => (x.id === promo.id ? { ...x, groups: x.groups.filter((g) => g !== group) } : x)));
      log(`${group} supprimé de ${promo.name}`);
      toast.show(`${group} supprimé`);
    } else {
      unassign(promo.groups.map((g) => promoKey(promo.name, g)));
      setPromotions((list) => list.filter((x) => x.id !== promo.id));
      log(`Promotion ${promo.name} supprimée`);
      toast.show(`${promo.name} supprimée`);
    }
  };

  const create = (p: Omit<Promotion, 'id'>) => {
    setPromotions((list) => [...list, { ...p, id: Math.max(0, ...list.map((x) => x.id)) + 1 }]);
    log(`Promotion ${p.name} créée (${p.groups.length} groupes)`);
    toast.show(`${p.name} créée`);
    setCreating(false);
  };

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
                <select className={`${inputClass} mt-1`} value={p.referent} onChange={(e) => setReferent(p, e.target.value)}>
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
              <button onClick={() => addGroup(p)} className="font-semibold text-brand hover:underline">+ Ajouter un groupe</button>
              <Link to="/admin" className="text-muted hover:text-navy">Voir les comptes →</Link>
            </div>
          </section>
        ))}
      </div>

      {creating && <PromoForm teachers={teachers} existing={promotions.map((p) => p.name.toLowerCase())} onSave={create} onClose={() => setCreating(false)} />}

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
  existing,
  onSave,
  onClose,
}: {
  teachers: string[];
  existing: string[];
  onSave: (p: Omit<Promotion, 'id'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [year, setYear] = useState('2026-2027');
  const [groups, setGroups] = useState(3);
  const [referent, setReferent] = useState(teachers[0] ?? '');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Donne un nom à la promotion.');
    if (existing.includes(n.toLowerCase())) return setError('Une promotion porte déjà ce nom.');
    onSave({ name: n, year, referent, groups: Array.from({ length: groups }, (_, i) => `Groupe ${i + 1}`) });
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
          <button type="submit" className={buttonPrimary}>Créer</button>
        </div>
      </form>
    </Modal>
  );
}
