import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, getToken } from '../api';
import { homeFor, useAuth } from '../auth';
import DataTable, { type TableData } from '../components/DataTable';
import Logo from '../components/layout/Logo';
import Markdown from '../components/Markdown';
import { buttonBrand, buttonOutline, buttonPrimary, inputClass } from '../components/ui';
import { formatClock, useCountdown, useStream } from '../stream';

type SeatStatus = 'ACTIVE' | 'LOCKED' | 'EXCLUDED' | 'SUBMITTED';

interface ExamChallenge {
  id: number;
  title: string;
  statement: string;
  difficulty: string;
  starterCode: string;
  tables: (TableData & { name: string })[];
}

interface StudentView {
  code: string;
  title: string;
  status: 'LOBBY' | 'RUNNING' | 'FINISHED';
  durationMin: number;
  total: number;
  serverNow: number;
  endsAt: number | null;
  me?: { status: SeatStatus; leaveCount: number; lockReason: string | null };
  challenges: ExamChallenge[];
  saved: Record<string, string>;
  result?: { correct: number; total: number; grade: number };
}

/** Page à part (sans le menu du site) : rien sur quoi cliquer pour sortir de l'examen par mégarde. */
function Frame({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Logo to="/examen" badge="Examen" />
          <div className="ml-auto flex items-center gap-3">{right}</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

function useStudentOnly() {
  const { role } = useAuth();
  if (!role) return <Navigate to="/connexion" replace />;
  if (role !== 'etudiant') return <Navigate to={homeFor(role)} replace />;
  return null;
}

// ───────────── Saisie du code ─────────────

export function ExamenCode() {
  const guard = useStudentOnly();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (guard) return guard;

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ code: string }>('/exams/join', { body: { code } });
      navigate(`/examen/${res.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code refusé.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame right={<button onClick={() => navigate('/')} className="text-sm text-muted hover:text-brand">Retour au tableau de bord</button>}>
      <div className="mx-auto mt-10 max-w-md rounded-lg bg-panel p-6">
        <h1 className="text-2xl font-semibold">Rejoindre un examen</h1>
        <p className="mt-1 text-sm text-muted">Saisis le code que ton enseignant t’a donné en cours.</p>
        <form onSubmit={join} className="mt-5 space-y-3">
          <label htmlFor="exam-code" className="sr-only">Code de l’examen</label>
          <input
            id="exam-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex. K7PQ2"
            autoComplete="off"
            autoFocus
            maxLength={8}
            className={`${inputClass} text-center font-mono text-2xl tracking-[0.3em]`}
          />
          {error && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          <button type="submit" disabled={busy || code.trim().length < 4} className={`${buttonPrimary} w-full`}>
            Entrer dans l’examen
          </button>
        </form>
        <Rules />
      </div>
    </Frame>
  );
}

function Rules() {
  return (
    <div className="mt-5 rounded-md border border-brand bg-brand-light p-4 text-xs">
      <p className="flex items-center gap-1.5 font-semibold"><ShieldAlert size={14} /> Examen surveillé</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        <li>Pendant l’examen, reste sur cette page : changer d’onglet, passer à une autre fenêtre, réduire, fermer ou recharger la page <strong>bloque ta copie</strong>.</li>
        <li>Ton enseignant est prévenu tout de suite et décide de te débloquer, ou non.</li>
        <li>Tes réponses sont enregistrées au fur et à mesure : un blocage ne les efface pas.</li>
      </ul>
    </div>
  );
}

// ───────────── Examen ─────────────

const draftKey = (code: string) => `levelupjv-exam-${code}`;
const readDrafts = (code: string): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(draftKey(code)) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
};

/** Signale une sortie de page. `keepalive` : la requête part même si la page se ferme. */
function reportLeave(code: string, reason: string) {
  const token = getToken();
  void fetch(`/api/exams/${code}/leave`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ reason }),
  }).catch(() => undefined);
}

export default function Examen() {
  const guard = useStudentOnly();
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const [joined, setJoined] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Rejoindre à nouveau (lien direct, rechargement) : sans effet si l'étudiant est déjà inscrit.
  useEffect(() => {
    if (guard) return;
    api<{ code: string }>('/exams/join', { body: { code } })
      .then((r) => setJoined(r.code))
      .catch((e) => {
        // Examen terminé : on peut encore afficher la copie et la note si l'étudiant y participait.
        if (e instanceof ApiError && e.status === 404) setJoined(code.toUpperCase());
        else setJoinError(e instanceof Error ? e.message : 'Examen introuvable.');
      });
  }, [code, guard]);

  const { data, error, connected } = useStream<StudentView>(joined ? `/exams/${joined}/stream` : null);
  const remaining = useCountdown(data?.status === 'RUNNING' ? data.endsAt : null, data?.serverNow);

  if (guard) return guard;

  const err = joinError ?? (!data ? error : null);
  if (err || !data) {
    return (
      <Frame>
        <div className="mx-auto mt-10 max-w-md space-y-3 rounded-lg bg-panel p-6 text-center text-sm">
          {err ? <p role="alert" className="text-red-800">{err}</p> : <p role="status" className="text-muted">Connexion à l’examen…</p>}
          {err && <button onClick={() => navigate('/examen')} className={buttonOutline}>Saisir un autre code</button>}
        </div>
      </Frame>
    );
  }

  const status = data.me?.status ?? 'ACTIVE';
  const timer = data.status === 'RUNNING' && remaining !== null && (
    <span className={`rounded-md px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${remaining < 300 ? 'bg-red-600 text-white' : 'bg-navy text-white'}`} aria-label="Temps restant">
      {formatClock(remaining)}
    </span>
  );
  const net = !connected && <span className="text-xs font-semibold text-red-600">Connexion perdue… reconnexion</span>;

  return (
    <Frame right={<>{net}{timer}</>}>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{data.title}</h1>
        <p className="text-sm text-muted">Code {data.code} · {data.total} défi{data.total > 1 ? 's' : ''} · {data.durationMin} min</p>
      </div>

      {data.status === 'LOBBY' && (
        <div className="mx-auto max-w-xl rounded-lg bg-panel p-6 text-center">
          <p className="text-lg font-semibold">Tu es inscrit. L’examen va bientôt commencer.</p>
          <p className="mt-1 text-sm text-muted">Les sujets s’afficheront ici dès que ton enseignant lancera l’examen.</p>
          <div className="text-left"><Rules /></div>
        </div>
      )}

      {data.status === 'FINISHED' && (
        <div className="mx-auto max-w-xl rounded-lg bg-panel p-6 text-center">
          <p className="text-lg font-semibold">L’examen est terminé.</p>
          {data.result && data.me ? (
            <p className="mt-2 text-sm">
              Défis réussis : <strong>{data.result.correct} / {data.result.total}</strong> · Note indicative : <strong>{data.result.grade} / 20</strong>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">Tu n’as pas participé à cet examen.</p>
          )}
          <button onClick={() => navigate('/')} className={`${buttonOutline} mt-4`}>Retour au tableau de bord</button>
        </div>
      )}

      {data.status === 'RUNNING' && status === 'SUBMITTED' && (
        <Notice tone="ok" title="Copie rendue">Tu peux fermer cette page. Ta note s’affichera ici à la fin de l’examen.</Notice>
      )}
      {data.status === 'RUNNING' && status === 'EXCLUDED' && (
        <Notice tone="bad" title="Ta copie a été close par l’enseignant">Tes réponses enregistrées avant le blocage seront corrigées.</Notice>
      )}
      {data.status === 'RUNNING' && (status === 'ACTIVE' || status === 'LOCKED') && <Workspace view={data} />}
    </Frame>
  );
}

function Notice({ tone, title, children }: { tone: 'ok' | 'bad'; title: string; children: ReactNode }) {
  return (
    <div role="status" className={`mx-auto max-w-xl rounded-lg p-6 text-center ${tone === 'ok' ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

/** Espace de travail + surveillance de la page. Monté seulement pendant l'examen. */
function Workspace({ view }: { view: StudentView }) {
  const code = view.code;
  const serverLocked = view.me?.status === 'LOCKED';
  const [localLock, setLocalLock] = useState<string | null>(null);
  const locked = serverLocked || localLock !== null;

  // ── Surveillance : toute sortie de page bloque la copie (affichage immédiat, puis confirmé par le serveur).
  const reported = useRef(false);
  useEffect(() => {
    if (!serverLocked) {
      reported.current = false;
      setLocalLock(null);
    }
  }, [serverLocked]);

  useEffect(() => {
    if (serverLocked) return;
    const leave = (reason: string) => {
      if (reported.current) return;
      reported.current = true;
      setLocalLock(reason);
      reportLeave(code, reason);
    };
    const onVisibility = () => document.visibilityState === 'hidden' && leave('hidden');
    const onBlur = () => leave('blur');
    const onHide = () => leave('pagehide');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onHide);
    // Avertissement du navigateur avant de fermer ou recharger la page.
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    // Débloqué alors qu'il est encore sur un autre onglet : il est rebloqué tout de suite.
    if (document.visibilityState === 'hidden') leave('hidden');
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [code, serverLocked]);

  // Signalement perdu (coupure réseau) : on le renvoie tant que le serveur n'a pas confirmé le blocage.
  useEffect(() => {
    if (!localLock || serverLocked) return;
    const t = window.setInterval(() => reportLeave(code, localLock), 4000);
    return () => window.clearInterval(t);
  }, [code, localLock, serverLocked]);

  // ── Brouillons : gardés dans le navigateur, enregistrés sur le serveur quelques secondes après la frappe.
  const [drafts, setDrafts] = useState<Record<string, string>>(() => ({ ...view.saved, ...readDrafts(code) }));
  const [current, setCurrent] = useState(0);
  const [saved, setSaved] = useState<Record<string, string>>(view.saved);
  const [run, setRun] = useState<(TableData & { error?: string }) | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const challenges = view.challenges;
  const c = challenges[current];
  const textOf = useCallback((id: number) => drafts[id] ?? challenges.find((x) => x.id === id)?.starterCode ?? '', [drafts, challenges]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey(code), JSON.stringify(drafts));
    } catch {
      /* stockage plein */
    }
  }, [code, drafts]);

  const save = useCallback(
    async (id: number, text: string) => {
      if (!text.trim() || saved[id] === text.trim()) return true;
      try {
        await api(`/exams/${code}/answer`, { body: { challengeId: id, query: text } });
        setSaved((s) => ({ ...s, [id]: text.trim() }));
        return true;
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Enregistrement impossible.');
        return false;
      }
    },
    [code, saved],
  );

  // Dépend de l'identifiant et du texte (pas de l'objet `c`, recréé à chaque mise à jour du flux).
  const currentId = c?.id;
  const currentText = currentId !== undefined ? textOf(currentId) : '';
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (currentId === undefined || locked) return;
    const t = window.setTimeout(() => void saveRef.current(currentId, currentText), 2500);
    return () => window.clearTimeout(t);
  }, [currentId, currentText, locked]);

  if (!c && !locked) return <p role="status" className="text-sm text-muted">Chargement des sujets…</p>;

  const execute = async () => {
    if (!c) return;
    setBusy(true);
    setMessage(null);
    try {
      setRun(await api<TableData & { error?: string }>(`/exams/${code}/run`, { body: { challengeId: c.id, query: textOf(c.id) } }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Exécution impossible.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      for (const x of challenges) await save(x.id, textOf(x.id));
      await api(`/exams/${code}/submit`, { body: {} });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Impossible de rendre la copie.');
    } finally {
      setBusy(false);
      setConfirmSubmit(false);
    }
  };

  const isSaved = (id: number) => !!saved[id] && saved[id] === textOf(id).trim();

  return (
    <>
      {locked && <LockScreen reason={view.me?.lockReason ?? null} count={view.me?.leaveCount ?? 0} pending={!serverLocked} />}

      {c && (
        <div className={`grid gap-5 lg:grid-cols-[220px_1fr] ${locked ? 'pointer-events-none select-none blur-sm' : ''}`} aria-hidden={locked}>
          <nav aria-label="Défis de l’examen" className="space-y-1.5">
            {challenges.map((x, i) => (
              <button
                key={x.id}
                onClick={() => {
                  void save(c.id, textOf(c.id));
                  setCurrent(i);
                  setRun(null);
                  setMessage(null);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ${i === current ? 'bg-navy text-white' : 'bg-panel hover:bg-slate-200'}`}
              >
                <span className="truncate">{i + 1}. {x.title}</span>
                <span className={`shrink-0 text-[10px] font-semibold ${isSaved(x.id) ? (i === current ? 'text-green-300' : 'text-green-700') : 'opacity-50'}`}>
                  {isSaved(x.id) ? 'enregistré' : saved[x.id] ? 'modifié' : '—'}
                </span>
              </button>
            ))}
            <div className="pt-3">
              {confirmSubmit ? (
                <div className="space-y-2 rounded-md bg-brand-light p-3 text-xs">
                  <p>Rendre ta copie ? Tu ne pourras plus la modifier.</p>
                  <div className="flex gap-2">
                    <button onClick={submit} disabled={busy} className={`${buttonBrand} px-3 py-1.5 text-xs`}>Oui, rendre</button>
                    <button onClick={() => setConfirmSubmit(false)} className={`${buttonOutline} px-3 py-1.5 text-xs`}>Annuler</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmSubmit(true)} className={`${buttonOutline} w-full`}>Rendre ma copie</button>
              )}
            </div>
          </nav>

          <div className="min-w-0 space-y-5">
            <section className="rounded-lg bg-panel p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{current + 1}. {c.title}</h2>
                <span className="text-[11px] text-muted">{c.difficulty}</span>
              </div>
              <div className="mt-2 text-sm"><Markdown text={c.statement} /></div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {c.tables.map((t) => <DataTable key={t.name} title={t.name} table={t} />)}
              </div>
            </section>

            <section className="rounded-lg bg-panel p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Ta requête SQL</h2>
                <span className="text-[11px] text-muted">{isSaved(c.id) ? 'Enregistrée' : 'Enregistrement automatique…'}</span>
              </div>
              <label className="sr-only" htmlFor="exam-editor">Éditeur de requête SQL</label>
              <textarea
                id="exam-editor"
                value={textOf(c.id)}
                onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                spellCheck={false}
                rows={9}
                disabled={locked}
                className="mt-3 w-full resize-y rounded-md bg-[#1b2238] p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button onClick={execute} disabled={busy || locked} className={buttonOutline}>Exécuter</button>
                <button onClick={() => void save(c.id, textOf(c.id))} disabled={busy || locked || isSaved(c.id)} className={buttonPrimary}>Enregistrer ma réponse</button>
              </div>
              <p className="mt-2 text-xs italic text-muted">« Exécuter » affiche le résultat de ta requête. La correction reste cachée jusqu’à la fin de l’examen.</p>
              {message && <p role="alert" className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>}
              {run && (
                <div className="mt-3">
                  {run.error ? <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{run.error}</p> : <DataTable title="Résultat" table={run} />}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function LockScreen({ reason, count, pending }: { reason: string | null; count: number; pending: boolean }) {
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="lock-title" className="fixed inset-0 z-50 flex items-center justify-center bg-navy/90 p-4">
      <div className="max-w-md rounded-lg bg-white p-6 text-center shadow-xl">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600"><Lock size={28} /></span>
        <h2 id="lock-title" className="mt-3 text-xl font-semibold">Copie bloquée</h2>
        <p className="mt-2 text-sm">
          Tu as quitté la page de l’examen{reason ? ` (${reason})` : ''}. Ton enseignant a été prévenu.
        </p>
        <p className="mt-2 text-sm font-semibold">Reste sur cette page et attends sa décision : elle s’appliquera ici automatiquement.</p>
        <p className="mt-3 text-xs text-muted">
          {pending ? 'Envoi du signalement…' : `Sorties de page pendant cet examen : ${count}.`} Tes réponses enregistrées sont conservées.
        </p>
      </div>
    </div>
  );
}
