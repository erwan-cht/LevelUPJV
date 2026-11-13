import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock, Star, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api, useApi } from '../api';
import PageState from '../components/PageState';
import { subjectStyles } from '../subjects';
import { useMe } from '../me';
import type { Subject } from '../types';
import { Breadcrumb, buttonBrand, buttonOutline, buttonPrimary } from '../components/ui';

interface Table {
  columns: string[];
  rows: string[][];
}

interface ChallengeDetail {
  id: number;
  title: string;
  statement: string;
  type: string;
  subject: Subject;
  difficulty: string;
  minutes: number;
  points: number;
  competence: string | null;
  starterCode: string;
  tables: (Table & { name: string })[];
  gradable: boolean;
  attempts: number;
  /** null : tentatives illimitées. */
  maxAttempts: number | null;
  favorite: boolean;
  /** Défi déjà réussi : les indices ne sont plus proposés. */
  solved: boolean;
  hints: { level: number; cost: number; text: string | null }[];
}

interface AttemptResponse {
  status: 'PASSED' | 'FAILED' | 'ERROR';
  message: string;
  expected?: Table;
  obtained?: Table;
  pointsAwarded: number;
  /** Coût des indices utilisés, déduit du gain à la première réussite. */
  hintCost?: number;
}

type Outcome =
  | { kind: 'idle' }
  | { kind: 'run'; result: Table & { error?: string } }
  | ({ kind: 'attempt' } & AttemptResponse);

export default function DefiDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi<ChallengeDetail>(`/challenges/${id}`);

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      {data ? (
        <DefiContent key={data.id} challenge={data} />
      ) : (
        <Link to="/defis" className={buttonPrimary}>
          Retour aux défis
        </Link>
      )}
    </PageState>
  );
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function DefiContent({ challenge }: { challenge: ChallengeDetail }) {
  const { refreshMe } = useMe();
  const st = subjectStyles[challenge.subject];

  const [query, setQuery] = useState(challenge.starterCode);
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(challenge.attempts);
  const [fav, setFav] = useState(challenge.favorite);
  const [hints, setHints] = useState(challenge.hints);
  const [solved, setSolved] = useState(challenge.solved);
  const [seconds, setSeconds] = useState(0);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const fail = (e: unknown) => setProblem(e instanceof Error ? e.message : 'Erreur inconnue.');

  const run = async () => {
    setBusy(true);
    setProblem('');
    try {
      const result = await api<Table & { error?: string }>(`/challenges/${challenge.id}/run`, { body: { query } });
      setOutcome({ kind: 'run', result });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const validate = async () => {
    setBusy(true);
    setProblem('');
    try {
      const res = await api<AttemptResponse>(`/challenges/${challenge.id}/attempt`, { body: { answer: query } });
      setOutcome({ kind: 'attempt', ...res });
      if (res.status === 'PASSED') setSolved(true); // les indices disparaissent dès la réussite
      setAttempts((a) => a + 1);
      refreshMe();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const toggleFav = async () => {
    setFav((f) => !f);
    try {
      await api(`/challenges/${challenge.id}/favorite`, { method: 'POST', body: {} });
    } catch {
      setFav((f) => !f);
    }
  };

  const unlock = async (level: number) => {
    setProblem('');
    try {
      const res = await api<{ level: number; text: string }>(`/challenges/${challenge.id}/hints`, { body: { level } });
      setHints((list) => list.map((h) => (h.level === level ? { ...h, text: res.text } : h)));
      refreshMe();
    } catch (e) {
      fail(e);
    }
  };

  const nextLocked = hints.find((h) => h.text === null);
  const passed = outcome.kind === 'attempt' && outcome.status === 'PASSED';
  const comparison = outcome.kind === 'attempt' && outcome.expected && outcome.obtained ? outcome : null;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Défis', to: '/defis' }, { label: challenge.subject }, { label: challenge.title }]} />

      <Link to="/defis" className={`${buttonOutline} px-3 py-1.5 text-xs`}>
        <ArrowLeft className="h-3.5 w-3.5" /> Retour aux défis
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{challenge.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded px-2 py-1 font-semibold text-white ${st.bar}`}>{challenge.subject}</span>
            <span className="rounded border border-slate-300 bg-white px-2 py-1">{challenge.difficulty}</span>
            <span className="rounded border border-brand bg-brand-light px-2 py-1 font-semibold text-brand">
              +{challenge.points} pts
            </span>
            {challenge.competence && <span className="italic text-muted">Compétence BUT : {challenge.competence}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Meter label="Temps" value={mmss(seconds)} />
          <Meter
            label="Tentative"
            value={challenge.maxAttempts === null ? `${attempts + 1}` : `${Math.min(attempts + 1, challenge.maxAttempts)} / ${challenge.maxAttempts}`}
          />
          <button onClick={toggleFav} aria-pressed={fav} aria-label="Favori">
            <Star className={`h-6 w-6 ${fav ? 'fill-navy text-navy' : 'text-muted'}`} />
          </button>
        </div>
      </header>

      {problem && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {problem}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-lg border border-sky-600 bg-white">
            <h2 className="bg-sky-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">Énoncé</h2>
            <div className="space-y-3 p-4 text-sm">
              <p className="whitespace-pre-line">{challenge.statement.replace(/[*`]/g, '')}</p>
              {challenge.gradable && (
                <p className="rounded bg-panel p-2 text-xs italic text-muted">
                  Une seule requête SELECT. Ton résultat est comparé automatiquement au résultat attendu.
                </p>
              )}
            </div>
          </section>

          {challenge.tables.length > 0 && (
            <section className="overflow-hidden rounded-lg border border-navy bg-white">
              <h2 className="bg-navy px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">Tables disponibles</h2>
              <div className="space-y-4 p-4">
                {challenge.tables.map((t) => (
                  <div key={t.name}>
                    <p className="mb-1 text-xs font-semibold">{t.name}</p>
                    <DataTable columns={t.columns} rows={t.rows} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-lg border border-navy bg-white">
            <h2 className="bg-navy px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
              {challenge.type === 'SQL' ? 'Votre requête SQL' : 'Votre réponse'}
            </h2>
            <div className="p-4">
              <label className="sr-only" htmlFor="editor">Éditeur</label>
              <textarea
                id="editor"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                spellCheck={false}
                rows={8}
                className="w-full resize-y rounded-md bg-[#1b2238] p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              {!challenge.gradable && (
                <p className="mt-2 text-xs italic text-muted">
                  La correction automatique de ce type de défi n’est pas encore disponible.
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button onClick={run} disabled={busy || !challenge.gradable} className={buttonOutline}>
                  Exécuter
                </button>
                <button onClick={validate} disabled={busy || !challenge.gradable} className={buttonBrand}>
                  Valider ma réponse
                </button>
                <span className="ml-auto text-[11px] italic text-muted">Environnement isolé · lecture seule</span>
              </div>
            </div>
          </section>

          <section className={`overflow-hidden rounded-lg border bg-white ${passed ? 'border-green-600' : 'border-red-600'}`}>
            <h2 className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white ${passed ? 'bg-green-600' : 'bg-red-600'}`}>
              Résultat de l’exécution
            </h2>
            <div className="space-y-4 p-4" aria-live="polite">
              {busy && <p className="text-sm text-muted">Exécution en cours…</p>}
              {!busy && outcome.kind === 'idle' && (
                <p className="text-sm text-muted">Exécute ou valide ta requête pour voir le résultat ici.</p>
              )}

              {!busy && outcome.kind === 'run' && (
                outcome.result.error ? (
                  <Alert tone="red">{outcome.result.error}</Alert>
                ) : (
                  <div>
                    <p className="mb-1 text-xs font-semibold">VOTRE RÉSULTAT · {outcome.result.rows.length} ligne(s)</p>
                    <DataTable columns={outcome.result.columns} rows={outcome.result.rows} />
                  </div>
                )
              )}

              {!busy && outcome.kind === 'attempt' && (
                <>
                  {outcome.status === 'PASSED' ? (
                    <p className="flex items-center gap-2 rounded-md bg-green-100 px-3 py-2 text-sm text-green-800">
                      <CheckCircle2 className="h-4 w-4" /> {outcome.message}
                      {outcome.pointsAwarded > 0
                        ? ` +${outcome.pointsAwarded} pts${outcome.hintCost ? ` (${outcome.pointsAwarded + outcome.hintCost} − ${outcome.hintCost} d’indices)` : ''}`
                        : outcome.hintCost
                          ? ' (les indices ont consommé tout le gain)'
                          : ' (points déjà obtenus)'}
                    </p>
                  ) : (
                    <Alert tone="red">{outcome.message}</Alert>
                  )}
                  {comparison && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold text-green-700">RÉSULTAT ATTENDU · {comparison.expected!.rows.length} ligne(s)</p>
                        <DataTable columns={comparison.expected!.columns} rows={comparison.expected!.rows} tone="bg-green-50" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold text-red-700">VOTRE RÉSULTAT · {comparison.obtained!.rows.length} ligne(s)</p>
                        <DataTable columns={comparison.obtained!.columns} rows={comparison.obtained!.rows} tone={passed ? 'bg-green-50' : 'bg-red-50'} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {!solved && (
      <section className="overflow-hidden rounded-lg border border-navy bg-white">
        <h2 className="bg-navy px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
          Indices · sans donner la réponse
        </h2>
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            {hints.map((h) => {
              const open = h.text !== null;
              return (
                <div
                  key={h.level}
                  className={`rounded-md border p-3 text-xs ${open ? 'border-brand bg-brand-light' : 'border-slate-200 bg-panel text-muted'}`}
                >
                  <p className="mb-1 flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5">
                      {!open && <Lock className="h-3 w-3" />}
                      Indice {h.level}{!open && ' · verrouillé'}
                    </span>
                    <span className={open ? 'text-[10px] font-bold text-brand' : ''}>
                      {h.cost === 0 ? 'GRATUIT' : `-${h.cost} pts sur le gain`}
                    </span>
                  </p>
                  <p>{open ? h.text : 'Débloque cet indice pour le lire.'}</p>
                </div>
              );
            })}
          </div>
          {nextLocked && (
            <button onClick={() => unlock(nextLocked.level)} className={`${buttonOutline} mt-3`}>
              Débloquer l’indice {nextLocked.level}
              {nextLocked.cost > 0 && ` (-${nextLocked.cost} pts sur le gain)`}
            </button>
          )}
        </div>
      </section>
      )}
    </div>
  );
}

function Alert({ tone, children }: { tone: 'red'; children: React.ReactNode }) {
  return (
    <p className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${tone === 'red' ? 'border-red-300 bg-red-50 text-red-800' : ''}`}>
      <XCircle className="h-4 w-4 shrink-0" /> {children}
    </p>
  );
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function DataTable({ columns, rows, tone = 'bg-white' }: { columns: string[]; rows: string[][]; tone?: string }) {
  return (
    <div className={`overflow-x-auto rounded border border-slate-200 ${tone}`}>
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-100">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-1.5 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-200">
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-1.5">{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={Math.max(columns.length, 1)} className="px-3 py-2 text-muted">Aucune ligne.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
