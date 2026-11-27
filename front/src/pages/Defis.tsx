import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, LayoutGrid, Search, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../api';
import PageState from '../components/PageState';
import SubjectLogo from '../components/SubjectLogo';
import { subjects } from '../subjects';
import type { ApiChallenge, Difficulty, Subject } from '../types';
import { Breadcrumb, DifficultyDots, PageTitle, ProgressBar } from '../components/ui';

type StatusFilter = 'tous' | 'a-faire' | 'en-cours' | 'termines' | 'favoris';
type SortKey = 'suggestion' | 'points' | 'duree';

const statusOptions: [StatusFilter, string][] = [
  ['tous', 'Tous les défis'],
  ['a-faire', 'À faire'],
  ['en-cours', 'En cours'],
  ['termines', 'Réussis'],
  ['favoris', 'Mes favoris'],
];
const sortOptions: [SortKey, string][] = [
  ['suggestion', 'Suggestions d’abord'],
  ['points', 'Plus de points'],
  ['duree', 'Plus courts'],
];

/** Ordre « suggestions » : recommandés par l'enseignant, puis en cours, puis à faire, puis réussis. */
const rank = (c: ApiChallenge) =>
  c.status === 'termine' ? 3 : c.recommended ? 0 : c.status === 'en-cours' ? 1 : 2;

export default function Defis() {
  const { data, loading, error, reload } = useApi<ApiChallenge[]>('/challenges');
  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      {data && <DefisContent catalog={data} />}
    </PageState>
  );
}

function DefisContent({ catalog }: { catalog: ApiChallenge[] }) {
  const [subject, setSubject] = useState<'toutes' | Subject>('toutes');
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'toutes' | Difficulty>('toutes');
  const [status, setStatus] = useState<StatusFilter>('tous');
  const [sort, setSort] = useState<SortKey>('suggestion');
  const [favorites, setFavorites] = useState<Set<number>>(() => new Set(catalog.filter((c) => c.favorite).map((c) => c.id)));

  const toggleFav = (id: number) => {
    const flip = (prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    };
    setFavorites(flip);
    // Si l'enregistrement échoue, on annule le changement affiché.
    api(`/challenges/${id}/favorite`, { method: 'POST', body: {} }).catch(() => setFavorites(flip));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = catalog.filter((c) => {
      if (subject !== 'toutes' && c.subject !== subject) return false;
      if (q && !`${c.title} ${c.description}`.toLowerCase().includes(q)) return false;
      if (difficulty !== 'toutes' && c.difficulty !== difficulty) return false;
      if (status === 'a-faire' && c.status !== 'nouveau') return false;
      if (status === 'en-cours' && c.status !== 'en-cours') return false;
      if (status === 'termines' && c.status !== 'termine') return false;
      if (status === 'favoris' && !favorites.has(c.id)) return false;
      return true;
    });
    if (sort === 'points') return [...list].sort((a, b) => b.points - a.points);
    if (sort === 'duree') return [...list].sort((a, b) => a.minutes - b.minutes);
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [catalog, subject, query, difficulty, status, sort, favorites]);

  const done = catalog.filter((c) => c.status === 'termine');
  const earned = done.reduce((s, c) => s + c.points, 0);
  const filtersOn = query.trim() !== '' || difficulty !== 'toutes' || status !== 'tous';
  const resetFilters = () => {
    setQuery('');
    setDifficulty('toutes');
    setStatus('tous');
  };
  const competence = subject !== 'toutes' ? catalog.find((c) => c.subject === subject && c.competence)?.competence : null;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Défis' }]} />

      <PageTitle title="Défis" subtitle={`${done.length} réussi${done.length > 1 ? 's' : ''} sur ${catalog.length} · ${earned} pts gagnés`} />

      {/* Matières : onglets qui filtrent la liste */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Matière">
        <SubjectTab
          active={subject === 'toutes'}
          onClick={() => setSubject('toutes')}
          logo={
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-500 text-white">
              <LayoutGrid className="h-4 w-4" />
            </span>
          }
          label="Toutes"
          done={done.length}
          total={catalog.length}
        />
        {subjects.map((s) => {
          const items = catalog.filter((c) => c.subject === s);
          return (
            <SubjectTab
              key={s}
              active={subject === s}
              onClick={() => setSubject(s)}
              logo={<SubjectLogo subject={s} size="h-8 w-8" />}
              label={s}
              done={items.filter((c) => c.status === 'termine').length}
              total={items.length}
            />
          );
        })}
      </div>

      {/* Recherche et filtres sur une seule ligne */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Rechercher un défi</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un défi…"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>
        <Select label="Statut" value={status} onChange={(v) => setStatus(v as StatusFilter)} options={statusOptions} />
        <Select
          label="Niveau"
          value={difficulty}
          onChange={(v) => setDifficulty(v as 'toutes' | Difficulty)}
          options={[['toutes', 'Tous les niveaux'], ['Facile', 'Facile'], ['Moyen', 'Moyen'], ['Difficile', 'Difficile']]}
        />
        <Select label="Trier" value={sort} onChange={(v) => setSort(v as SortKey)} options={sortOptions} />
      </div>

      {competence && <p className="text-xs italic text-muted">Compétence BUT travaillée : {competence}</p>}

      {filtered.length === 0 ? (
        <div className="rounded-lg bg-panel p-8 text-center text-sm text-muted">
          <p>Aucun défi ne correspond à ta recherche.</p>
          {filtersOn && (
            <button onClick={resetFilters} className="mt-3 font-semibold text-brand hover:underline">
              Effacer les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <ChallengeCard key={c.id} c={c} fav={favorites.has(c.id)} onFav={() => toggleFav(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubjectTab({
  active,
  onClick,
  logo,
  label,
  done,
  total,
}: {
  active: boolean;
  onClick: () => void;
  logo: React.ReactNode;
  label: string;
  done: number;
  total: number;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2.5 rounded-lg border-2 px-3 py-2 text-left transition-colors ${
        active ? 'border-navy bg-white' : 'border-transparent bg-panel hover:border-slate-300'
      }`}
    >
      {logo}
      <span>
        <span className="block whitespace-nowrap text-sm font-semibold">{label}</span>
        <span className="block text-[11px] text-muted">
          {done} / {total} réussis
        </span>
      </span>
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
    >
      {options.map(([v, text]) => (
        <option key={v} value={v}>
          {text}
        </option>
      ))}
    </select>
  );
}

function ChallengeCard({ c, fav, onFav }: { c: ApiChallenge; fav: boolean; onFav: () => void }) {
  const action = c.status === 'termine' ? 'Revoir' : c.status === 'en-cours' ? 'Reprendre' : 'Commencer';

  return (
    <article className="flex flex-col rounded-lg bg-panel p-4">
      <div className="flex items-center gap-2">
        <SubjectLogo subject={c.subject} size="h-8 w-8" />
        <DifficultyDots level={c.difficulty} />
        <button
          onClick={onFav}
          aria-pressed={fav}
          aria-label={fav ? `Retirer ${c.title} des favoris` : `Ajouter ${c.title} aux favoris`}
          className="ml-auto"
        >
          <Star className={`h-4 w-4 ${fav ? 'fill-brand text-brand' : 'text-muted hover:text-navy'}`} />
        </button>
      </div>

      <h3 className="mt-3 font-semibold">{c.title}</h3>
      <p className="mt-1 line-clamp-2 flex-1 text-xs text-muted">{c.description}</p>

      {/* Un seul état, le plus utile */}
      <div className="mt-3 min-h-5 text-[11px] font-semibold">
        {c.status === 'termine' ? (
          <span className="flex items-center gap-1 text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Réussi
          </span>
        ) : c.status === 'en-cours' && c.progress !== undefined ? (
          <span className="flex items-center gap-2 text-brand">
            En cours
            <ProgressBar value={c.progress} max={100} color="bg-brand" track="bg-white" />
          </span>
        ) : c.recommended ? (
          <span className="rounded bg-brand-light px-1.5 py-0.5 text-brand">Recommandé par ton enseignant</span>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
        <span className="flex items-center gap-3 text-xs">
          <span className="font-bold text-brand">+{c.points} pts</span>
          <span className="flex items-center gap-1 text-muted">
            <Clock className="h-3 w-3" /> {c.minutes} min
          </span>
        </span>
        <Link
          to={`/defis/${c.id}`}
          className={`rounded px-4 py-1.5 text-xs font-semibold transition-colors ${
            c.status === 'termine'
              ? 'border border-navy bg-white text-navy hover:bg-slate-100'
              : 'bg-navy text-white hover:bg-navy-light'
          }`}
        >
          {action}
        </Link>
      </div>
    </article>
  );
}
