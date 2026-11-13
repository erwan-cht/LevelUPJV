import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { subjectCompetence, subjects } from '../../data/catalog';
import type { Competence } from '../../types';
import { Breadcrumb, PageTitle, ProgressBar, buttonBrand, buttonOutline, buttonPrimary, inputClass } from '../../components/ui';
import { useAdmin } from './store';
import { ConfirmDialog, Field, Modal, useToast } from './ui';

export default function Referentiel() {
  const { competences, setCompetences, log } = useAdmin();
  const toast = useToast();
  const [editing, setEditing] = useState<Competence | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Competence | null>(null);

  const save = (c: Pick<Competence, 'name' | 'description'>) => {
    if (editing === 'new') {
      setCompetences((list) => [...list, { ...c, value: 0 }]);
      log(`Compétence « ${c.name} » ajoutée au référentiel`);
      toast.show(`« ${c.name} » ajoutée`);
    } else if (editing) {
      setCompetences((list) => list.map((x) => (x.name === editing.name ? { ...x, ...c } : x)));
      log(`Compétence « ${c.name} » modifiée`);
      toast.show(`« ${c.name} » enregistrée`);
    }
    setEditing(null);
  };

  const remove = (c: Competence) => {
    setCompetences((list) => list.filter((x) => x.name !== c.name));
    log(`Compétence « ${c.name} » retirée du référentiel`);
    toast.show(`« ${c.name} » supprimée`);
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Administration', to: '/admin' }, { label: 'Référentiel' }]} />
      <PageTitle title="Référentiel de compétences" subtitle="Les compétences du BUT Informatique auxquelles chaque défi est rattaché.">
        <button onClick={() => setEditing('new')} className={buttonBrand}>
          <Plus className="h-4 w-4" /> Nouvelle compétence
        </button>
      </PageTitle>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <h2 className="bg-navy px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
            Compétences ({competences.length})
          </h2>
          <ul className="divide-y divide-slate-100">
            {competences.map((c, i) => (
              <li key={c.name} className="flex items-center gap-4 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-panel text-xs font-bold">C{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-[11px] text-muted">{c.description}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar value={c.value} max={100} height="h-1.5" />
                    <span className="w-24 shrink-0 text-[10px] text-muted">{c.value} % acquis</span>
                  </div>
                </div>
                <button onClick={() => setEditing(c)} aria-label={`Modifier ${c.name}`} className="rounded p-1.5 hover:bg-panel"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setToDelete(c)} aria-label={`Supprimer ${c.name}`} className="rounded p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
            {competences.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">Le référentiel est vide.</li>}
          </ul>
        </section>

        <aside>
          <section className="overflow-hidden rounded-lg border border-sky-600 bg-white">
            <h2 className="bg-sky-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">Rattachement par matière</h2>
            <ul className="divide-y divide-slate-100">
              {subjects.map((s) => (
                <li key={s} className="px-4 py-2.5">
                  <p className="text-sm font-semibold">{s}</p>
                  <p className="text-[11px] text-muted">{subjectCompetence[s]}</p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {editing && (
        <CompetenceForm
          competence={editing === 'new' ? null : editing}
          taken={(name) => competences.some((c) => c.name.toLowerCase() === name.toLowerCase() && c !== editing)}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title={`Supprimer « ${toDelete.name} » ?`}
          message="Les défis rattachés à cette compétence ne seront plus comptés dans le portfolio des étudiants."
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

function CompetenceForm({
  competence,
  taken,
  onSave,
  onClose,
}: {
  competence: Competence | null;
  taken: (name: string) => boolean;
  onSave: (c: Pick<Competence, 'name' | 'description'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(competence?.name ?? '');
  const [description, setDescription] = useState(competence?.description ?? '');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Le nom est obligatoire.');
    if (taken(n)) return setError('Cette compétence existe déjà.');
    onSave({ name: n, description: description.trim() });
  };

  return (
    <Modal title={competence ? 'Modifier la compétence' : 'Nouvelle compétence'} onClose={onClose} width="max-w-md">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nom" error={error}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Réaliser" />
        </Field>
        <Field label="Description">
          <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Développer des applications informatiques" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={buttonOutline}>Annuler</button>
          <button type="submit" className={buttonPrimary}>{competence ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </form>
    </Modal>
  );
}
