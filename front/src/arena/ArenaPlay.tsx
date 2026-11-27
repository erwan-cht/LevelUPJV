import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Crown, Loader2, Send, Timer, Trophy, XCircle } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { type BoardRow, type PlayerView, mmss, useArenaStream, useCountdown } from './hooks';

interface Verdict {
  correct: boolean;
  message: string;
  attempts?: number;
  points?: number;
}

/** Écran de l'étudiant (pensé pour le téléphone) : attente, défi en cours, résultat, podium. */
export default function ArenaPlay() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { view, status, error, skew } = useArenaStream(code);
  const player = view?.role === 'player' ? view : null;
  const left = useCountdown(player?.endsAt, skew);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="flex items-center justify-between gap-3">
        <span className="rounded-lg bg-brand px-3 py-1 text-sm font-bold tracking-widest text-white">{code}</span>
        {player?.me && player.phase !== 'lobby' && (
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-brand" /> {player.me.rank}
            <span className="text-muted">/ {player.me.outOf}</span> · {player.me.points} pts
          </span>
        )}
        {status === 'connecting' && <span className="rounded bg-panel px-2 py-0.5 text-xs text-muted">reconnexion…</span>}
      </header>

      {error && (
        <div role="alert" className="space-y-3 rounded-lg bg-red-100 p-4 text-sm text-red-800">
          <p>{error}</p>
          <button onClick={() => navigate('/arene')} className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white">
            Saisir un autre code
          </button>
        </div>
      )}
      {!player && !error && <p role="status" className="py-16 text-center text-muted">Connexion à la salle…</p>}

      {player?.phase === 'lobby' && <Waiting player={player} />}
      {player?.phase === 'question' && <Question key={player.challenge?.id} player={player} code={code} left={left} />}
      {player?.phase === 'reveal' && <Between player={player} />}
      {player?.phase === 'finished' && <Final player={player} />}
    </div>
  );
}

// ───────────── Attente ─────────────

function Waiting({ player }: { player: PlayerView }) {
  return (
    <section className="rounded-2xl bg-navy p-8 text-center text-white">
      <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand" />
      <h1 className="mt-4 text-2xl font-bold">Tu es dans la salle !</h1>
      <p className="mt-2 text-white/70">
        {player.joined} joueur{player.joined > 1 ? 's' : ''} · {player.total} défi{player.total > 1 ? 's' : ''} de {Math.round(player.timeLimitSec / 60)} min.
      </p>
      <p className="mt-6 text-sm text-white/60">L’enseignant va lancer la partie. Garde cette page ouverte.</p>
    </section>
  );
}

// ───────────── Défi en cours ─────────────

function Question({ player, code, left }: { player: PlayerView; code: string; left: number | null }) {
  const c = player.challenge;
  const [query, setQuery] = useState(c?.starterCode ?? '');
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [problem, setProblem] = useState('');
  const solved = player.current?.solved || verdict?.correct;
  const closed = left === 0;
  const urgent = left !== null && left <= 20;
  const editor = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    editor.current?.focus({ preventScroll: true });
  }, []);

  const send = async () => {
    if (busy || solved || closed || !query.trim()) return;
    setBusy(true);
    setProblem('');
    try {
      setVerdict(await api<Verdict>(`/arena/${code}/answer`, { body: { query } }));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Défi {player.index + 1} / {player.total}
          </p>
          <h1 className="truncate text-xl font-bold">{c?.title}</h1>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-lg font-black tabular-nums ${urgent ? 'animate-pulse bg-red-600 text-white' : 'bg-navy text-white'}`}>
          <Timer className="h-4 w-4" /> {left === null ? '…' : mmss(left)}
        </span>
      </div>

      <p className="whitespace-pre-line rounded-lg border border-sky-600 bg-white p-4 text-sm">{c?.statement.replace(/[*`]/g, '')}</p>

      {problem && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {problem}
        </p>
      )}
      {solved ? (
        <p role="status" className="viz-row flex items-center gap-2 rounded-lg bg-green-100 px-4 py-3 font-semibold text-green-800">
          <CheckCircle2 className="h-5 w-5" /> Bien joué ! {(player.current?.points || verdict?.points) ? `+${player.current?.points || verdict?.points} pts` : ''}
          <span className="ml-auto text-xs font-normal">Attends la fin du temps.</span>
        </p>
      ) : (
        verdict && (
          <p role="status" className="viz-row flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" /> <span>{verdict.message} <span className="text-xs text-red-600">(tentative {verdict.attempts})</span></span>
          </p>
        )
      )}
      <details className="rounded-lg border border-slate-200 bg-white" open={(c?.tables.length ?? 0) <= 2}>
        <summary className="cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-wide text-navy">Tables disponibles</summary>
        <div className="space-y-3 overflow-x-auto p-3">
          {c?.tables.map((t) => (
            <div key={t.name}>
              <p className="mb-1 text-xs font-semibold">{t.name}</p>
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100">
                  <tr>
                    {t.columns.map((col) => (
                      <th key={col} className="px-2 py-1">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.slice(0, 6).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {r.map((cell, j) => (
                        <td key={j} className="px-2 py-1">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </details>

      <div>
        <label htmlFor="arena-query" className="sr-only">
          Ta requête SQL
        </label>
        <textarea
          id="arena-query"
          ref={editor}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send();
          }}
          disabled={Boolean(solved) || closed}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={6}
          className="w-full resize-y rounded-md bg-[#1b2238] p-3 font-mono text-sm leading-6 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => void send()}
            disabled={busy || Boolean(solved) || closed || !query.trim()}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-brand text-base font-bold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />} Valider
          </button>
          <span className="hidden text-xs text-muted sm:inline">Ctrl + Entrée</span>
        </div>
      </div>

      {closed && !solved && <p className="text-center text-sm text-muted">Temps écoulé : l’enseignant va montrer l’analyse.</p>}
    </section>
  );
}

// ───────────── Entre deux défis ─────────────

function Between({ player }: { player: PlayerView }) {
  const ok = player.current?.solved;
  return (
    <section className={`space-y-3 rounded-2xl p-8 text-center text-white ${ok ? 'bg-green-600' : 'bg-navy'}`}>
      {ok ? <CheckCircle2 className="mx-auto h-12 w-12" /> : <XCircle className="mx-auto h-12 w-12 text-white/70" />}
      <h1 className="text-2xl font-bold">{ok ? `Réussi ! +${player.current?.points} pts` : 'Pas cette fois'}</h1>
      <p className="text-white/80">
        Tu es {player.me?.rank}
        {player.me?.rank === 1 ? 'er' : 'e'} sur {player.me?.outOf} avec {player.me?.points} pts.
      </p>
      <p className="text-sm text-white/60">Regarde l’écran de la salle : l’analyse est en cours.</p>
    </section>
  );
}

// ───────────── Fin ─────────────

function Final({ player }: { player: PlayerView }) {
  const rows: BoardRow[] = player.full ?? player.leaderboard;
  const me = player.me;
  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-navy p-8 text-center text-white">
        <Crown className="mx-auto h-12 w-12 text-brand" />
        <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-white/60">Séance terminée</p>
        <h1 className="text-4xl font-black">
          {me?.rank}
          <sup className="text-xl">{me?.rank === 1 ? 'er' : 'e'}</sup> <span className="text-xl font-semibold text-white/70">sur {me?.outOf}</span>
        </h1>
        <p className="mt-2 text-white/80">
          {me?.points} pts · {me?.solved} défi{(me?.solved ?? 0) > 1 ? 's' : ''} réussi{(me?.solved ?? 0) > 1 ? 's' : ''}
        </p>
      </div>
      <ol className="space-y-1 rounded-lg bg-white p-4">
        {rows.slice(0, 10).map((r) => (
          <li key={r.pseudo} className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm last:border-0">
            <span>
              <span className="mr-3 inline-block w-5 text-right text-muted">{r.rank}</span>
              {r.pseudo}
            </span>
            <span className="tabular-nums">{r.points} pts</span>
          </li>
        ))}
      </ol>
      <Link to="/arene" className="block rounded-lg border border-slate-300 bg-white py-3 text-center text-sm font-semibold">
        Rejoindre une autre arène
      </Link>
    </section>
  );
}
