import { useEffect, useMemo, useState } from 'react';
import { Code2, Database, Globe, Network, Swords } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api, useApi } from '../api';
import PageState from '../components/PageState';
import { subjects } from '../subjects';
import type { Difficulty, Subject } from '../types';
import { Avatar, Breadcrumb, Card, CardTitle, Segmented, buttonBrand, buttonOutline } from '../components/ui';

const icons: Record<Subject, typeof Database> = {
  'Bases de données': Database,
  Algorithmique: Code2,
  'Développement web': Globe,
  'Réseaux & systèmes': Network,
};

const iconColor: Record<Subject, string> = {
  'Bases de données': 'bg-sky-600',
  Algorithmique: 'bg-brand',
  'Développement web': 'bg-navy',
  'Réseaux & systèmes': 'bg-red-600',
};

type Level = Difficulty | 'Au hasard';
type Kind = 'classe' | 'amical';

interface DuelsData {
  stats: { wins: number; losses: number; played: number };
  available: { subject: Subject; difficulty: Difficulty; count: number }[];
  invites: { id: number; name: string; initials: string; subject: string; difficulty: string; ranked: boolean }[];
  recent: { id: number; result: 'Victoire' | 'Défaite' | 'Égalité'; opponent: string; subject: string; points: number }[];
  opponents: {
    id: number;
    name: string;
    initials: string;
    level: number;
    league: string;
    online: boolean;
    status: 'dispo' | 'hors-ligne' | 'en-duel' | 'indisponible';
  }[];
  open: { id: number; status: 'PENDING' | 'ACTIVE' } | null;
  stake: number;
}

const resultStyle = {
  Victoire: 'bg-green-100 text-green-700',
  Défaite: 'bg-red-100 text-red-700',
  Égalité: 'bg-slate-200 text-navy',
} as const;

export default function Duels() {
  const { data, loading, error, reload } = useApi<DuelsData>('/duels');

  // Les invitations et la présence des camarades évoluent : on relit la page toutes les 5 secondes.
  useEffect(() => {
    const id = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(id);
  }, [reload]);

  return (
    <PageState loading={loading && !data} error={data ? null : error} onRetry={reload}>
      {data && <DuelsContent data={data} reload={reload} />}
    </PageState>
  );
}

function DuelsContent({ data, reload }: { data: DuelsData; reload: () => Promise<void> }) {
  const navigate = useNavigate();
  const countFor = (s: Subject, d?: Level) =>
    data.available.filter((a) => a.subject === s && (!d || d === 'Au hasard' || a.difficulty === d)).reduce((n, a) => n + a.count, 0);

  const [subject, setSubject] = useState<Subject>(() => subjects.find((s) => countFor(s) > 0) ?? subjects[0]);
  const [level, setLevel] = useState<Level>('Au hasard');
  const [kind, setKind] = useState<Kind>('classe');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const available = useMemo(() => countFor(subject, level), [subject, level, data.available]);

  const launch = async (opponentId?: number) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ id: number }>('/duels', {
        body: { subject, difficulty: level, ranked: kind === 'classe', ...(opponentId ? { opponentId } : {}) },
      });
      navigate(`/duels/${res.id}`);
    } catch (e) {
      setMessage(e instanceof ApiError || e instanceof Error ? e.message : 'Impossible de lancer le duel.');
      void reload();
    } finally {
      setBusy(false);
    }
  };

  const answer = async (id: number, action: 'accept' | 'decline') => {
    setMessage(null);
    try {
      await api(`/duels/${id}/${action}`, { body: {} });
      if (action === 'accept') navigate(`/duels/${id}`);
      else await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Action impossible.');
      void reload();
    }
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Duels' }]} />

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-navy p-6 text-white">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold">Affronte un camarade en direct</h1>
          <p className="mt-1 text-sm text-slate-300">
            Même exercice, même chrono : le premier à obtenir le bon résultat remporte les points. Choisis une matière,
            puis un adversaire.
          </p>
        </div>
        <div className="flex gap-3">
          {[
            ['Victoires', data.stats.wins],
            ['Défaites', data.stats.losses],
            ['Duels joués', data.stats.played],
          ].map(([label, value]) => (
            <div key={label} className="min-w-24 rounded-md bg-white/10 px-4 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-300">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {data.open && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand bg-brand-light p-4 text-sm">
          <p>
            {data.open.status === 'ACTIVE' ? 'Tu as un duel en cours.' : 'Ton invitation attend une réponse.'}
          </p>
          <Link to={`/duels/${data.open.id}`} className={buttonBrand}>
            {data.open.status === 'ACTIVE' ? 'Reprendre mon duel' : 'Voir mon invitation'}
          </Link>
        </div>
      )}

      {message && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {message}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardTitle>Paramètres du duel</CardTitle>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Matière</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {subjects.map((s) => {
                const Icon = icons[s];
                const selected = subject === s;
                const n = countFor(s);
                return (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    aria-pressed={selected}
                    disabled={n === 0}
                    title={n === 0 ? 'Pas encore d’exercice corrigé automatiquement pour cette matière' : undefined}
                    className={`rounded-lg border-2 bg-white p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'border-brand' : 'border-transparent hover:border-slate-300'}`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-md text-white ${iconColor[s]}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="mt-2 text-sm font-semibold">{s}</p>
                    <p className="text-[11px] text-muted">{n === 0 ? 'bientôt' : `${n} exercice${n > 1 ? 's' : ''}`}</p>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted">Difficulté</p>
            <div className="mt-2">
              <Segmented<Level> options={['Facile', 'Moyen', 'Difficile', 'Au hasard']} value={level} onChange={setLevel} />
            </div>
            {available === 0 && (
              <p className="mt-2 text-xs text-red-700">Aucun exercice {level.toLowerCase()} pour cette matière : choisis un autre niveau.</p>
            )}

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted">Type de duel</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {([
                ['classe', 'Duel classé', `+${data.stake} pts au vainqueur.`],
                ['amical', 'Duel amical', 'Pour s’entraîner : aucun point en jeu.'],
              ] as [Kind, string, string][]).map(([id, title, text]) => (
                <button
                  key={id}
                  onClick={() => setKind(id)}
                  aria-pressed={kind === id}
                  className={`rounded-lg border-2 bg-white p-3 text-left ${kind === id ? 'border-navy' : 'border-transparent hover:border-slate-300'}`}
                >
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted">{text}</p>
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button onClick={() => launch()} disabled={busy || available === 0 || Boolean(data.open)} className={buttonBrand}>
                <Swords className="h-4 w-4" />
                {busy ? 'Envoi de l’invitation…' : 'Trouver un adversaire au hasard'}
              </button>
              <span className="text-xs italic text-muted">Ou défie directement un camarade dans la liste.</span>
            </div>
            <p className="mt-3 text-[11px] text-muted">
              Les duels utilisent les exercices SQL, corrigés automatiquement. L’adversaire reçoit une invitation et le chrono démarre quand il l’accepte.
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Duels récents</CardTitle>
              <Link to="/profil" className="text-xs font-semibold text-brand hover:underline">Voir l’historique</Link>
            </div>
            {data.recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Aucun duel terminé pour le moment.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.recent.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-sm">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${resultStyle[d.result]}`}>{d.result}</span>
                    <span className="flex-1">contre <strong>{d.opponent}</strong> · {d.subject}</span>
                    <span className="font-semibold">{d.points} pt{d.points > 1 ? 's' : ''}</span>
                  </li>
                ))}
              </ul>
            )}
            {data.stats.wins === 0 && (
              <p className="mt-3 text-xs italic text-muted">
                Pas encore de victoire : le badge « Duelliste » se débloque dès ton premier duel gagné.
              </p>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Invitations reçues</CardTitle>
              <span className="text-xs text-muted">{data.invites.length}</span>
            </div>
            {data.invites.length === 0 && <p className="mt-3 text-sm text-muted">Aucune invitation pour le moment.</p>}
            {data.invites.map((inv) => (
              <div key={inv.id} className="mt-3 rounded-lg border border-brand bg-brand-light p-3">
                <div className="flex items-center gap-3 text-sm">
                  <Avatar initials={inv.initials} size="h-8 w-8 text-xs" />
                  <p>
                    <strong>{inv.name}</strong> te défie en <strong>{inv.subject}</strong> · {inv.difficulty}
                    {!inv.ranked && <span className="text-muted"> (amical)</span>}
                  </p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => answer(inv.id, 'accept')} disabled={Boolean(data.open)} className={`${buttonBrand} px-3 py-1.5 text-xs`}>Accepter</button>
                  <button onClick={() => answer(inv.id, 'decline')} className={`${buttonOutline} px-3 py-1.5 text-xs`}>Refuser</button>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Camarades de ta promo</CardTitle>
              <span className="text-xs text-muted">{data.opponents.filter((o) => o.online).length} en ligne</span>
            </div>
            {data.opponents.length === 0 && <p className="mt-3 text-sm text-muted">Aucun camarade dans ta promo pour le moment.</p>}
            <ul className="mt-3 space-y-2">
              {data.opponents.map((o) => (
                <li key={o.id} className="flex items-center gap-3 rounded-md bg-white px-3 py-2">
                  <span className="relative">
                    <Avatar initials={o.initials} size="h-8 w-8 text-xs" />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${o.status === 'dispo' ? 'bg-green-500' : o.status === 'en-duel' ? 'bg-brand' : 'bg-slate-300'}`}
                    />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{o.name}</p>
                    <p className="text-[11px] text-muted">Niveau {o.level} · {o.league}</p>
                  </div>
                  {o.status === 'dispo' || o.status === 'hors-ligne' ? (
                    <button
                      onClick={() => launch(o.id)}
                      disabled={busy || available === 0 || Boolean(data.open)}
                      className={`${buttonOutline} px-3 py-1 text-xs`}
                    >
                      Défier
                    </button>
                  ) : (
                    <span className="rounded bg-brand-light px-2 py-1 text-[11px] font-semibold text-brand">
                      {o.status === 'en-duel' ? 'En duel' : 'Indisponible'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
