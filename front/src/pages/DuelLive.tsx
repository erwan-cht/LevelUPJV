import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, api } from '../api';
import DataTable, { type TableData } from '../components/DataTable';
import PageState from '../components/PageState';
import { useMe } from '../me';
import { Avatar, Breadcrumb, Card, CardTitle, ProgressBar, buttonBrand, buttonOutline, buttonPrimary } from '../components/ui';

const pad = (n: number) => String(n).padStart(2, '0');

interface PlayerState {
  name: string;
  initials: string;
  sub: string;
  passed: number;
  total: number;
}

interface DuelState {
  id: number;
  status: 'PENDING' | 'ACTIVE' | 'FINISHED' | 'DECLINED';
  ranked: boolean;
  stake: number;
  iAmChallenger: boolean;
  remainingSec: number;
  challenge: {
    title: string;
    statement: string;
    subject: string;
    difficulty: string;
    starterCode: string;
    tables: (TableData & { name: string })[];
  };
  me: PlayerState;
  opponent: PlayerState;
  winner: 'me' | 'opponent' | 'draw' | null;
  feed: { time: string; who: string; text: string }[];
  lastResult: { status: 'PASSED' | 'FAILED' | 'ERROR'; message: string; expected: TableData | null; obtained: TableData | null } | null;
}

interface Verdict {
  status: 'PASSED' | 'FAILED' | 'ERROR';
  message: string;
  expected?: TableData;
  obtained?: TableData;
}

export default function DuelLive() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshMe } = useMe();

  const [state, setState] = useState<DuelState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [, tick] = useState(0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<(TableData & { error?: string }) | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const initialised = useRef(false);
  const finishedSeen = useRef(false);
  const refreshRef = useRef(refreshMe);
  refreshRef.current = refreshMe;

  const load = useCallback(async () => {
    try {
      const s = await api<DuelState>(`/duels/${id}`);
      setState(s);
      setFetchedAt(Date.now());
      setError(null);
      // Le code de départ n'est inséré qu'une fois, pour ne pas écraser ce que l'étudiant écrit.
      if (!initialised.current) {
        initialised.current = true;
        setCode(s.challenge.starterCode);
      }
      // Fin du duel : les points ont peut-être changé.
      if (s.status === 'FINISHED' && !finishedSeen.current) {
        finishedSeen.current = true;
        refreshRef.current();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Duel introuvable.');
    }
  }, [id]);

  const open = state?.status === 'PENDING' || state?.status === 'ACTIVE';

  useEffect(() => {
    void load();
  }, [load]);

  // Relecture toutes les 2 s tant que le duel n'est pas terminé ; le chrono avance chaque seconde entre deux lectures.
  useEffect(() => {
    if (!open) return;
    const poll = window.setInterval(() => void load(), 2000);
    const clock = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [open, load]);

  const post = async <T,>(path: string, body: unknown = {}) => {
    setBusy(true);
    try {
      return await api<T>(`/duels/${id}${path}`, { body });
    } catch (e) {
      setVerdict({ status: 'ERROR', message: e instanceof ApiError || e instanceof Error ? e.message : 'Action impossible.' });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    setVerdict(null);
    const res = await post<TableData & { error?: string }>('/run', { query: code });
    if (res) setRun(res);
  };

  const submit = async () => {
    setRun(null);
    const res = await post<Verdict & { won?: boolean }>('/submit', { answer: code });
    if (res) setVerdict(res);
    void load();
  };

  const leave = async (action: 'abandon' | 'decline' | 'accept') => {
    const res = await post(`/${action}`);
    if (res === null) return;
    if (action === 'accept') void load();
    else navigate('/duels');
  };

  if (!state) {
    return (
      <PageState loading={!error} error={error} onRetry={() => void load()}>
        {null}
      </PageState>
    );
  }

  const remaining = state.status === 'ACTIVE' ? Math.max(0, state.remainingSec - Math.floor((Date.now() - fetchedAt) / 1000)) : state.remainingSec;
  const active = state.status === 'ACTIVE';
  const feedback = verdict ?? (state.lastResult && active ? state.lastResult : null);

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Duels', to: '/duels' }, { label: 'Duel en direct' }]} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Duel en direct</h1>
          <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${active ? 'bg-red-600' : state.status === 'PENDING' ? 'bg-brand' : 'bg-slate-500'}`}>
            {active ? 'En cours' : state.status === 'PENDING' ? 'En attente' : state.status === 'FINISHED' ? 'Terminé' : 'Annulé'}
          </span>
        </div>
        <p className="text-xs italic text-muted">
          {state.challenge.subject} · {state.challenge.difficulty} · {state.challenge.title}
        </p>
      </div>

      {/* Bandeau des joueurs */}
      <section className="grid items-center gap-4 rounded-lg bg-navy p-5 text-white md:grid-cols-[1fr_auto_1fr]">
        <Player p={state.me} color="bg-brand" />
        <div className="text-center">
          <p className="text-xs font-bold text-brand">VS</p>
          <p className="font-mono text-4xl font-bold tabular-nums" aria-live="off">
            {pad(Math.floor(remaining / 60))}:{pad(remaining % 60)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-300">{state.status === 'PENDING' ? 'Durée du duel' : 'Temps restant'}</p>
          <p className="mt-2 inline-block rounded bg-brand px-3 py-1 text-[11px] font-bold text-navy">
            {state.ranked ? `+${state.stake} pts pour le vainqueur` : 'Duel amical'}
          </p>
        </div>
        <Player p={state.opponent} color="bg-slate-500" right />
      </section>

      {state.status === 'PENDING' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand bg-brand-light p-4 text-sm">
          {state.iAmChallenger ? (
            <>
              <p>En attente de la réponse de <strong>{state.opponent.name}</strong>… Le chrono démarre quand l’invitation est acceptée.</p>
              <button onClick={() => leave('decline')} disabled={busy} className={buttonOutline}>Annuler l’invitation</button>
            </>
          ) : (
            <>
              <p><strong>{state.opponent.name}</strong> te défie. Le chrono démarre quand tu acceptes.</p>
              <div className="flex gap-2">
                <button onClick={() => leave('accept')} disabled={busy} className={buttonBrand}>Accepter</button>
                <button onClick={() => leave('decline')} disabled={busy} className={buttonOutline}>Refuser</button>
              </div>
            </>
          )}
        </div>
      )}

      {state.status === 'DECLINED' && (
        <div className="rounded-lg bg-panel p-4 text-sm">
          Ce duel a été refusé ou annulé. <button onClick={() => navigate('/duels')} className="font-semibold text-brand hover:underline">Retour aux duels</button>
        </div>
      )}

      {state.status === 'FINISHED' && (
        <div
          role="status"
          className={`rounded-lg p-4 text-sm font-semibold ${state.winner === 'me' ? 'bg-green-100 text-green-800' : state.winner === 'opponent' ? 'bg-red-100 text-red-800' : 'bg-panel'}`}
        >
          {state.winner === 'me' && `Victoire !${state.ranked ? ` +${state.stake} points.` : ''}`}
          {state.winner === 'opponent' && `Défaite : ${state.opponent.name} l’emporte.`}
          {state.winner === 'draw' && 'Égalité : personne ne l’emporte.'}{' '}
          <button onClick={() => navigate('/duels')} className="ml-2 font-semibold underline">Retour aux duels</button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Énoncé</CardTitle>
              <span className="text-[11px] text-muted">{state.challenge.subject} · {state.challenge.difficulty}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{state.challenge.statement.replace(/\*\*/g, '')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {state.challenge.tables.map((t) => (
                <DataTable key={t.name} title={t.name} table={t} />
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Ta requête SQL</CardTitle>
              <span className="text-[11px] text-muted">Une seule requête SELECT</span>
            </div>
            <label className="sr-only" htmlFor="duel-editor">Éditeur de requête SQL</label>
            <textarea
              id="duel-editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              rows={8}
              disabled={!active}
              className="mt-3 w-full resize-y rounded-md bg-[#1b2238] p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <button onClick={execute} disabled={!active || busy} className={buttonOutline}>Exécuter</button>
              <button onClick={submit} disabled={!active || busy} className={buttonPrimary}>Soumettre ma solution</button>
              {active && (
                <button
                  onClick={() => leave('abandon')}
                  disabled={busy}
                  className="ml-auto rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Abandonner
                </button>
              )}
            </div>
            <p className="mt-2 text-xs italic text-muted">
              {active
                ? 'Soumets quand ton résultat te semble bon : le premier à obtenir le résultat attendu remporte le duel.'
                : 'L’éditeur est désactivé : le duel n’est pas en cours.'}
            </p>
          </Card>

          {(run || feedback) && (
            <Card>
              <CardTitle>{run ? 'Résultat de ta requête' : 'Dernière soumission'}</CardTitle>
              {run &&
                (run.error ? (
                  <p role="alert" className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{run.error}</p>
                ) : (
                  <div className="mt-3"><DataTable table={run} /></div>
                ))}
              {!run && feedback && (
                <div className="mt-2 space-y-3">
                  <p
                    role="status"
                    className={`rounded px-3 py-2 text-sm ${feedback.status === 'PASSED' ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800'}`}
                  >
                    {feedback.status === 'PASSED' ? 'Bravo ! Résultat identique à celui attendu.' : feedback.message}
                  </p>
                  {feedback.status === 'FAILED' && feedback.expected && feedback.obtained && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DataTable title="Attendu" table={feedback.expected} />
                      <DataTable title="Obtenu" table={feedback.obtained} />
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Fil du duel</CardTitle>
              <span className="text-[11px] text-muted">{active ? 'en direct' : ''}</span>
            </div>
            {state.feed.length === 0 ? (
              <p className="mt-3 text-xs text-muted">Le fil apparaîtra au début du duel.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-xs">
                {state.feed.map((e, i) => (
                  <li key={i} className="flex gap-3 rounded bg-white px-3 py-2">
                    <span className="font-mono text-muted">{e.time}</span>
                    <span>{e.who && <strong className={e.who === 'Vous' ? '' : 'text-brand'}>{e.who} · </strong>}{e.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle>Règles du duel</CardTitle>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-xs text-muted marker:text-sky-600">
              <li>Le premier qui obtient le résultat attendu gagne les points.</li>
              <li>Si le chrono s’arrête avant, celui qui a le plus avancé l’emporte ; à égalité, personne ne gagne.</li>
              <li>La requête de ton adversaire reste masquée : tu ne vois que sa progression.</li>
              <li>Pas d’indices pendant un duel.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Player({ p, color, right }: { p: PlayerState; color: string; right?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${right ? 'md:flex-row-reverse md:text-right' : ''}`}>
      <Avatar initials={p.initials} color={color} size="h-14 w-14 text-lg" />
      <div className="flex-1">
        <p className="font-semibold">{p.name}</p>
        <p className="text-[11px] text-slate-300">{p.sub}</p>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="whitespace-nowrap">Lignes trouvées</span>
          <ProgressBar value={p.passed} max={p.total} color={right ? 'bg-brand' : 'bg-white'} track="bg-white/20" height="h-2" />
          <strong className="whitespace-nowrap">{p.passed} / {p.total}</strong>
        </div>
      </div>
    </div>
  );
}
