import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Breadcrumb, PageTitle, ProgressBar, buttonBrand, buttonOutline, buttonPrimary, inputClass } from '../../components/ui';
import { useAdmin, type ReferentialCompetence } from './store';
import { ConfirmDialog, Field, Modal, useToast } from './ui';

export default function Referentiel() {
  const { competences, bySubject, saveCompetence, deleteCompetence } = useAdmin();
  const toast = useToast();
  const [editing, setEditing] = useState<ReferentialCompetence | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<ReferentialCompetence | null>(null);

  /** Enregistre la compétence ; renvoie le message d'erreur du serveur, ou null en cas de succès. */
  const save = async (c: { name: string; description: string }): Promise<string | null> => {
    try {
      await saveCompetence(editing === 'new' || editing === null ? null : editing.id, c);
      toast.show(editing === 'new' ? `« ${c.name} » ajoutée` : `« ${c.name} » enregistrée`);
      setEditing(null);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Enregistrement impossible.';
    }
  };

  const remove = async (c: ReferentialCompetence) => {
    try {
      await deleteCompetence(c.id);
      toast.show(`« ${c.name} » supprimée`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Suppression impossible.');
    }
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
              <li key={c.id} className="flex items-center gap-4 px-4 py-3">
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
              {bySubject.map((s) => (
                <li key={s.subject} className="px-4 py-2.5">
                  <p className="text-sm font-semibold">{s.subject}</p>
                  <p className="text-[11px] text-muted">{s.competences.length > 0 ? s.competences.join(' · ') : 'Aucun défi rattaché à une compétence.'}</p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {editing && (
        <CompetenceForm
          competence={editing === 'new' ? null : editing}
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
  onSave,
  onClose,
}: {
  competence: ReferentialCompetence | null;
  onSave: (c: { name: string; description: string }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(competence?.name ?? '');
  const [description, setDescription] = useState(competence?.description ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Le nom est obligatoire.');
    setBusy(true);
    const server = await onSave({ name: n, description: description.trim() });
    setBusy(false);
    if (server) setError(server);
  };

  return (
    <Modal title={competence ? 'Modifier la compétence' : 'Nouvelle compétence'} onClose={onClose} width="max-w-md">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nom" error={error}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Réaliser un développement d’application" />
        </Field>
        <Field label="Description">
          <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Développer des applications informatiques" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={buttonOutline}>Annuler</button>
          <button type="submit" disabled={busy} className={buttonPrimary}>{competence ? 'Enregistrer' : 'Ajouter'}</button>
        </div>
      </form>
    </Modal>
  );
}
