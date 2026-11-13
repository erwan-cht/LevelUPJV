import { useMemo, useState } from 'react';
import { Clock, Database, FlaskConical, Network, Search, Star, Code2, Globe, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../api';
import PageState from '../components/PageState';
import { subjectCompetence, subjectStyles, subjects } from '../data/catalog';
import type { ApiChallenge, CatalogChallenge, Difficulty, Subject } from '../types';
import { Breadcrumb, DifficultyDots, PageTitle, ProgressBar, Segmented } from '../components/ui';

const subjectIcon: Record<Subject, typeof Database> = {
  'Bases de données': Database,
  Algorithmique: Code2,
  'Développement web': Globe,
  'Réseaux & systèmes': Network,
};

type StatusFilter = 'Tous' | 'À faire' | 'En cours' | 'Terminés';
type SortKey = 'Recommandé' | 'Points' | 'Durée';

export default function Defis() {
  const { data, loading, error, reload } = useApi<ApiChallenge[]>('/challenges');
  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      {data && <DefisContent catalog={data} />}
    </PageState>
  );
}

function DefisContent({ catalog }: { catalog: ApiChallenge[] }) {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<'Toutes' | Difficulty>('Toutes');
  const [status, setStatus] = useState<StatusFilter>('Tous');
  const [sort, setSort] = useState<SortKey>('Recommandé');
  const [favorites, setFavorites] = useState<Set<number>>(
    () => new Set(catalog.filter((c) => c.favorite).map((c) => c.id)),
  );

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
      if (q && !`${c.title} ${c.description}`.toLowerCase().includes(q)) return false;
      if (difficulty !== 'Toutes' && c.difficulty !== difficulty) return false;
      if (status === 'À faire' && c.status !== 'nouveau') return false;
      if (status === 'En cours' && c.status !== 'en-cours') return false;
      if (status === 'Terminés' && c.status !== 'termine') return false;
      return true;
    });
    const sorted = [...list];
    if (sort === 'Points') sorted.sort((a, b) => b.points - a.points);
    if (sort === 'Durée') sorted.sort((a, b) => a.minutes - b.minutes);
    return sorted;
  }, [query, difficulty, status, sort]);

  const done = catalog.filter((c) => c.status === 'termine').length;
  const inProgress = catalog.filter((c) => c.status === 'en-cours').length;
  const earned = catalog.filter((c) => c.status === 'termine').reduce((s, c) => s + c.points, 0);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Défis' }]} />

      <PageTitle title="Défis" subtitle="Choisis une matière, un niveau, puis lance-toi. Chaque défi rapporte des points.">
        <div className="flex gap-2 text-xs">
          <Chip>{done} terminés sur {catalog.length}</Chip>
          <Chip>{inProgress} en cours</Chip>
          <Chip highlight>{earned} pts gagnés</Chip>
        </div>
      </PageTitle>

      {/* Résumé par matière */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {subjects.map((s) => {
          const items = catalog.filter((c) => c.subject === s);
          const finished = items.filter((c) => c.status === 'termine');
          const st = subjectStyles[s];
          const Icon = subjectIcon[s];
          return (
            <div key={s} className="rounded-lg bg-panel p-4">
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 items-center justify-center rounded-md text-white ${st.bar}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{s}</p>
                  <p className="text-xs text-muted">{items.length} défis</p>
                </div>
              </div>
              <div className="mt-3">
                <ProgressBar value={finished.length} max={items.length} color={st.bar} track="bg-white" />
                <p className="mt-1.5 flex justify-between text-[11px] text-muted">
                  <span>{finished.length} / {items.length}</span>
                  <span className="font-semibold text-brand">{finished.reduce((a, c) => a + c.points, 0)} pts gagnés</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-panel p-3 text-xs">
        <label className="relative min-w-52 flex-1">
          <span className="sr-only">Rechercher un défi</span>
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un défi ou un sujet"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>
        <Group label="Niveau">
          <Segmented options={['Toutes', 'Facile', 'Moyen', 'Difficile'] as const} value={difficulty} onChange={setDifficulty} />
        </Group>
        <Group label="Statut">
          <Segmented options={['Tous', 'À faire', 'En cours', 'Terminés'] as const} value={status} onChange={setStatus} />
        </Group>
        <Group label="Trier">
          <Segmented options={['Recommandé', 'Points', 'Durée'] as const} value={sort} onChange={setSort} />
        </Group>
      </div>

      {filtered.length === 0 && (
        <p className="rounded-lg bg-panel p-6 text-center text-sm text-muted">Aucun défi ne correspond à ces filtres.</p>
      )}

      {subjects.map((s) => {
        const items = filtered.filter((c) => c.subject === s);
        if (items.length === 0) return null;
        const st = subjectStyles[s];
        return (
          <section key={s} aria-labelledby={`sec-${st.short}`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`sec-${st.short}`} className={`border-l-4 pl-3 text-lg font-semibold ${st.border}`}>
                {s} <span className="text-xs font-normal text-muted">{items.length} défis</span>
              </h2>
              <p className="text-xs italic text-muted">Compétence BUT : {subjectCompetence[s]}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((c) => (
                <ChallengeCard key={c.id} c={c} fav={favorites.has(c.id)} onFav={() => toggleFav(c.id)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Chip({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1.5 font-medium ${highlight ? 'bg-brand-light text-brand' : 'bg-panel'}`}>
      {children}
    </span>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}

function ChallengeCard({ c, fav, onFav }: { c: CatalogChallenge; fav: boolean; onFav: () => void }) {
  const st = subjectStyles[c.subject];
  const action = c.status === 'termine' ? 'Revoir' : c.status === 'en-cours' ? 'Reprendre' : 'Commencer';
  return (
    <article className={`flex flex-col rounded-lg border-t-4 bg-panel p-4 ${st.border}`}>
      <div className="flex items-start justify-between gap-2">
        <DifficultyDots level={c.difficulty} />
        <button
          onClick={onFav}
          aria-pressed={fav}
          aria-label={fav ? `Retirer ${c.title} des favoris` : `Ajouter ${c.title} aux favoris`}
        >
          <Star className={`h-4 w-4 ${fav ? 'fill-navy text-navy' : 'text-muted'}`} />
        </button>
      </div>

      <h3 className="mt-2 text-sm font-semibold">{c.title}</h3>
      <p className="mt-1 flex-1 text-xs text-muted">{c.description}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {c.recommended && c.status === 'nouveau' && (
          <span className="rounded bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-brand">Recommandé</span>
        )}
        {c.status === 'termine' && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-green-600">
            <CheckCircle2 className="h-3 w-3" /> Réussi
          </span>
        )}
      </div>

      {c.status === 'en-cours' && c.progress !== undefined && (
        <div className="mt-2">
          <ProgressBar value={c.progress} max={100} color="bg-brand" track="bg-white" />
          <p className="mt-1 text-[11px] text-muted">Reprise : {c.progress} %</p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {c.minutes} min
        </span>
        <span className="flex items-center gap-1">
          <FlaskConical className="h-3 w-3" /> {c.tests} tests
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-bold text-brand">+{c.points} pts</span>
        <Link
          to={`/defis/${c.id}`}
          className={`rounded px-4 py-1.5 text-xs font-semibold transition-colors ${
            c.status === 'en-cours'
              ? 'bg-brand text-white hover:brightness-95'
              : c.status === 'termine'
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
