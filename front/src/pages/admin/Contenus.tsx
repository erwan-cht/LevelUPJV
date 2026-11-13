import { useMemo, useState } from 'react';
import { Eye, EyeOff, Search, Send } from 'lucide-react';
import { subjectStyles, subjects } from '../../subjects';
import type { Subject } from '../../types';
import { Breadcrumb, DifficultyDots, PageTitle, inputClass } from '../../components/ui';
import { useAdmin, type ContentStatus } from './store';
import { AuditLog, StatCard, selectClass, useToast } from './ui';

const statusInfo: Record<ContentStatus, { label: string; style: string }> = {
  publie: { label: 'Publié', style: 'bg-green-100 text-green-700' },
  brouillon: { label: 'Brouillon', style: 'bg-brand-light text-brand' },
  masque: { label: 'Masqué', style: 'bg-red-100 text-red-700' },
};

export default function Contenus() {
  const { contents, setContentStatus } = useAdmin();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<'toutes' | Subject>('toutes');
  const [status, setStatus] = useState<'tous' | ContentStatus>('tous');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contents.filter(
      (c) =>
        (!q || c.title.toLowerCase().includes(q)) &&
        (subject === 'toutes' || c.subject === subject) &&
        (status === 'tous' || c.status === status),
    );
  }, [contents, query, subject, status]);

  const count = (s: ContentStatus) => contents.filter((c) => c.status === s).length;

  const change = async (id: number, title: string, next: ContentStatus) => {
    const verb = next === 'publie' ? 'publié' : next === 'masque' ? 'masqué' : 'repassé en brouillon';
    try {
      await setContentStatus(id, next);
      toast.show(`« ${title} » ${verb}`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Action impossible.');
    }
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Administration', to: '/admin' }, { label: 'Contenus' }]} />
      <PageTitle title="Modération des contenus" subtitle="Publier, masquer ou repasser en brouillon les défis proposés par les enseignants." />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Publiés" value={count('publie')} hint="visibles par les étudiants" border="border-t-green-600" />
        <StatCard label="Brouillons" value={count('brouillon')} hint="en attente de relecture" border="border-t-brand" />
        <StatCard label="Masqués" value={count('masque')} hint="retirés du catalogue" border="border-t-red-600" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
            <label className="relative min-w-48 flex-1">
              <span className="sr-only">Rechercher un défi</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className={`${inputClass} pl-9`} placeholder="Titre du défi…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <select aria-label="Matière" className={selectClass} value={subject} onChange={(e) => setSubject(e.target.value as typeof subject)}>
              <option value="toutes">Toutes les matières</option>
              {subjects.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select aria-label="Statut" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="tous">Tous les statuts</option>
              {(Object.keys(statusInfo) as ContentStatus[]).map((s) => <option key={s} value={s}>{statusInfo[s].label}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-panel text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Défi</th>
                  <th className="px-3 py-2 font-semibold">Difficulté</th>
                  <th className="px-3 py-2 font-semibold">Points</th>
                  <th className="px-3 py-2 font-semibold">Statut</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold">{c.title}</p>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white ${subjectStyles[c.subject].bar}`}>{subjectStyles[c.subject].short}</span>
                      <span className="ml-2 text-[11px] text-muted">{c.description}</span>
                    </td>
                    <td className="px-3 py-2.5"><DifficultyDots level={c.difficulty} /></td>
                    <td className="px-3 py-2.5 text-xs font-semibold">{c.points}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${statusInfo[c.status].style}`}>{statusInfo[c.status].label}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1 text-xs">
                        {c.status !== 'publie' && (
                          <button onClick={() => change(c.id, c.title, 'publie')} className="inline-flex items-center gap-1 rounded border border-navy px-2 py-1 font-medium hover:bg-slate-50">
                            {c.status === 'masque' ? <Eye className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />} Publier
                          </button>
                        )}
                        {c.status !== 'masque' && (
                          <button onClick={() => change(c.id, c.title, 'masque')} className="inline-flex items-center gap-1 rounded border border-red-600 px-2 py-1 font-medium text-red-600 hover:bg-red-50">
                            <EyeOff className="h-3.5 w-3.5" /> Masquer
                          </button>
                        )}
                        {c.status === 'publie' && (
                          <button onClick={() => change(c.id, c.title, 'brouillon')} className="rounded px-2 py-1 text-muted hover:bg-panel hover:text-navy">
                            Brouillon
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-muted">Aucun défi ne correspond à ces filtres.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside><AuditLog /></aside>
      </div>

      {toast.node}
    </div>
  );
}
