import { useEffect, useState } from 'react';
import { BookOpen, Check, Crown, Maximize2, Play, SkipForward, Timer, Users, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import CourseDrawer from '../components/CourseDrawer';
import { type Analysis, type BoardRow, type HostView, mmss, useArenaStream, useCountdown } from './hooks';

const stagger = (i: number, base = 0) => ({ animationDelay: `${base + i * 90}ms` });

/** Écran de l'enseignant, pensé pour le vidéoprojecteur : gros texte, contrastes forts, tout en direct. */
export default function ArenaHost() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { view, status, error, skew } = useArenaStream(code);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [course, setCourse] = useState<{ page: number } | null>(null);

  const host = view?.role === 'host' ? view : null;
  const left = useCountdown(host?.endsAt, skew);

  const act = async (action: 'start' | 'reveal' | 'next' | 'finish') => {
    setBusy(true);
    setProblem('');
    try {
      await api(`/arena/${code}/${action}`, { body: {} });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  // Le temps est écoulé : le serveur passe seul à l'analyse ; on laisse l'écran respirer avant de le dire.
  const timeUp = host?.phase === 'question' && left === 0;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-navy text-white">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-navy/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-brand px-3 py-1 text-sm font-bold tracking-widest">{code}</span>
          {host && host.phase !== 'lobby' && (
            <span className="text-sm text-white/70">
              Défi {Math.min(host.index + 1, host.total)} / {host.total}
              {host.challenge && ` · ${host.challenge.title}`}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm text-white/70">
            <Users className="h-4 w-4" /> {host?.joined ?? 0}
          </span>
          {status === 'connecting' && <span className="rounded bg-white/15 px-2 py-0.5 text-xs">reconnexion…</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void document.documentElement.requestFullscreen?.()} className="rounded p-2 hover:bg-white/10" aria-label="Plein écran" title="Plein écran">
            <Maximize2 className="h-4 w-4" />
          </button>
          {host?.phase !== 'finished' && host && (
            <button
              onClick={() => confirm('Terminer la séance maintenant ?') && void act('finish')}
              className="rounded border border-white/30 px-3 py-1 text-xs font-semibold hover:bg-white/10"
            >
              Terminer
            </button>
          )}
          <button onClick={() => navigate('/enseignant/arene')} className="rounded p-2 hover:bg-white/10" aria-label="Quitter l’écran" title="Quitter">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-4">
        {error && <p role="alert" className="rounded-lg bg-red-500/20 p-4 text-sm">{error}</p>}
        {problem && <p role="alert" className="mb-4 rounded-lg bg-red-500/20 p-3 text-sm">{problem}</p>}
        {!host && !error && <p role="status" className="py-24 text-center text-white/60">Connexion à la salle…</p>}

        {host?.phase === 'lobby' && <Lobby host={host} busy={busy} onStart={() => void act('start')} />}

        {host?.phase === 'question' && (
          <Question host={host} left={left} timeUp={timeUp} busy={busy} onReveal={() => void act('reveal')} />
        )}

        {host?.phase === 'reveal' && (
          <Reveal host={host} busy={busy} onNext={() => void act('next')} onCourse={(page) => setCourse({ page })} />
        )}

        {host?.phase === 'finished' && <Finished host={host} onCourse={(page) => setCourse({ page })} onAgain={() => navigate('/enseignant/arene')} />}
      </main>

      {course && host?.review && (
        <CourseDrawer
          course={{ id: host.review.course.id, title: host.review.course.title, author: host.review.course.author, pages: host.review.course.total }}
          page={course.page}
          onPage={(page) => setCourse({ page })}
          onClose={() => setCourse(null)}
          onExplain={() => setCourse(null)}
        />
      )}
    </div>
  );
}

// ───────────── Salle d'attente ─────────────

function Lobby({ host, busy, onStart }: { host: HostView; busy: boolean; onStart: () => void }) {
  const [qr, setQr] = useState('');
  const url = `${window.location.origin}/arene?code=${host.code}`;

  useEffect(() => {
    void QRCode.toDataURL(url, { margin: 1, width: 420, color: { dark: '#26314f', light: '#ffffff' } }).then(setQr);
  }, [url]);

  return (
    <div className="grid items-center gap-10 py-8 lg:grid-cols-[auto_1fr]">
      <div className="viz-row mx-auto text-center">
        {qr && <img src={qr} alt={`QR code pour rejoindre l’arène ${host.code}`} className="mx-auto h-72 w-72 rounded-2xl bg-white p-3 shadow-2xl" />}
        <p className="mt-4 text-sm text-white/70">Scanne, ou va sur</p>
        <p className="text-lg font-semibold">{window.location.host}/arene</p>
        <p className="mt-1 text-5xl font-black tracking-[0.3em] text-brand">{host.code}</p>
      </div>

      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Arène live · {host.total} défi{host.total > 1 ? 's' : ''} · {Math.round(host.timeLimitSec / 60)} min chacun</p>
        <h1 className="mt-1 text-4xl font-bold">Qui rejoint la partie ?</h1>
        <p className="mt-2 text-white/70">{host.joined === 0 ? 'En attente des premiers joueurs…' : `${host.joined} joueur${host.joined > 1 ? 's' : ''} dans la salle`}</p>

        <ul className="mt-6 flex min-h-24 flex-wrap gap-2">
          {host.people.map((p, i) => (
            <li key={p} style={stagger(i % 8)} className="viz-row rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold">
              {p}
            </li>
          ))}
        </ul>

        <ol className="mt-4 space-y-1 text-sm text-white/60">
          {host.titles.map((t, i) => (
            <li key={i}>
              {i + 1}. {t}
            </li>
          ))}
        </ol>

        <button onClick={onStart} disabled={busy} className="mt-8 inline-flex items-center gap-3 rounded-xl bg-brand px-8 py-4 text-xl font-bold shadow-lg hover:brightness-110 disabled:opacity-60">
          <Play className="h-6 w-6" /> Lancer l’arène
        </button>
      </div>
    </div>
  );
}

// ───────────── Question en cours ─────────────

function Question({ host, left, timeUp, busy, onReveal }: { host: HostView; left: number | null; timeUp: boolean; busy: boolean; onReveal: () => void }) {
  const c = host.challenge;
  const ratio = left === null ? 1 : left / host.timeLimitSec;
  const urgent = left !== null && left <= 20;
  const R = 54;

  return (
    <div className="grid gap-8 py-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/60">{c?.difficulty}</p>
        <h1 className="text-4xl font-bold leading-tight">{c?.title}</h1>
        <p className="whitespace-pre-line text-2xl leading-relaxed text-white/90">{c?.statement.replace(/[*`]/g, '')}</p>

        <div className="grid gap-3 md:grid-cols-2">
          {c?.tables.map((t) => (
            <div key={t.name} className="overflow-hidden rounded-lg bg-white/10 text-sm">
              <p className="bg-white/15 px-3 py-1 font-semibold">{t.name}</p>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    {t.columns.map((col) => (
                      <th key={col} className="px-3 py-1 text-white/60">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.slice(0, 6).map((r, i) => (
                    <tr key={i} className="border-t border-white/10">
                      {r.map((cell, j) => (
                        <td key={j} className="px-3 py-1">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      <aside className="space-y-6">
        <div className="flex flex-col items-center">
          <div className="relative h-40 w-40">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={urgent ? '#ef4444' : '#ef8a0e'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * R}
                strokeDashoffset={2 * Math.PI * R * (1 - ratio)}
                className="transition-[stroke-dashoffset] duration-300 ease-linear"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-4xl font-black tabular-nums ${urgent ? 'animate-pulse text-red-400' : ''}`}>
              {left === null ? '…' : mmss(left)}
            </span>
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-white/70">
            <Timer className="h-4 w-4" /> {timeUp ? 'Temps écoulé…' : 'Temps restant'}
          </p>
        </div>

        <div className="rounded-xl bg-white/10 p-4 text-center">
          <p className="text-5xl font-black tabular-nums">
            {host.answered}
            <span className="text-2xl text-white/50"> / {host.joined}</span>
          </p>
          <p className="text-sm text-white/70">ont répondu · {host.solvedCount} ont réussi</p>
        </div>

        <MiniBoard rows={host.leaderboard.slice(0, 5)} />

        <button onClick={onReveal} disabled={busy} className="w-full rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-60">
          Voir l’analyse maintenant
        </button>
      </aside>
    </div>
  );
}

function MiniBoard({ rows, big = false }: { rows: BoardRow[]; big?: boolean }) {
  const top = Math.max(1, ...rows.map((r) => r.points));
  return (
    <ol className="space-y-2" aria-label="Classement">
      {rows.map((r, i) => (
        <li key={r.pseudo} style={stagger(i)} className="viz-row">
          <div className={`flex items-center justify-between ${big ? 'text-lg' : 'text-sm'}`}>
            <span className="flex items-center gap-2 font-semibold">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${r.rank === 1 ? 'bg-brand' : 'bg-white/20'}`}>{r.rank}</span>
              {r.pseudo}
            </span>
            <span className="tabular-nums text-white/80">{r.points}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${(r.points / top) * 100}%` }} />
          </div>
        </li>
      ))}
      {rows.length === 0 && <li className="text-sm text-white/50">Pas encore de points.</li>}
    </ol>
  );
}

// ───────────── Analyse de la salle ─────────────

const ring = (pct: number) => ({ background: `conic-gradient(#22c55e ${pct * 3.6}deg, rgba(255,255,255,.15) 0)` });

function AnalysisBlock({ a, review, onCourse }: { a: Analysis; review?: HostView['review']; onCourse: (page: number) => void }) {
  const top = a.byStep[0];
  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <div className="viz-row text-center">
        <div className="relative mx-auto h-44 w-44 rounded-full" style={ring(a.successPct)}>
          <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-navy">
            <span className="text-5xl font-black">{a.successPct}%</span>
            <span className="text-xs text-white/60">ont réussi</span>
          </div>
        </div>
        <p className="mt-3 text-sm text-white/70">
          {a.solved} / {a.participants} élèves
          {a.avgSolveSec !== null && ` · ${mmss(a.avgSolveSec)} en moyenne`}
        </p>
      </div>

      <div style={stagger(2)} className="viz-row">
        {top ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Là où ça coince</p>
            <p className="mt-1 text-3xl font-bold leading-snug">
              <span className="text-brand">{top.pct} %</span> des élèves qui se sont trompés l’ont d’abord fait à l’étape <span className="rounded bg-white/15 px-2 font-mono text-2xl">{top.step}</span>
            </p>
            <ul className="mt-5 space-y-2">
              {a.byStep.map((s, i) => (
                <li key={s.step} style={stagger(i, 300)} className="viz-row">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono font-semibold">{s.step}</span>
                    <span className="tabular-nums text-white/70">{s.count} élève{s.count > 1 ? 's' : ''} · {s.pct} %</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-brand transition-all duration-1000" style={{ width: `${s.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {review && review.pages.length > 0 && (
              <p className="mt-5 flex flex-wrap items-center gap-2 text-sm">
                <BookOpen className="h-4 w-4 text-brand" />
                <span className="text-white/70">À revoir dans le cours de {review.course.author} :</span>
                {review.pages.map((n) => (
                  <button key={n} onClick={() => onCourse(n)} className="rounded-full bg-white/15 px-3 py-0.5 font-semibold hover:bg-brand">
                    p. {n}
                  </button>
                ))}
              </p>
            )}
          </>
        ) : (
          <p className="text-2xl font-semibold">
            {a.answered === 0
              ? 'Personne n’a répondu.'
              : a.answered < a.participants
                ? `Aucune erreur parmi les réponses, mais ${a.participants - a.answered} élève${a.participants - a.answered > 1 ? 's' : ''} n’${a.participants - a.answered > 1 ? 'ont' : 'a'} pas répondu.`
                : 'Aucune erreur à signaler : bravo à la salle !'}
          </p>
        )}
        {a.stuck > 0 && <p className="mt-4 text-sm text-white/60">{a.stuck} élève{a.stuck > 1 ? 's' : ''} n’{a.stuck > 1 ? 'ont' : 'a'} pas trouvé la solution (alors qu’{a.stuck > 1 ? 'ils ont' : 'il a'} essayé).</p>}
      </div>
    </div>
  );
}

function Reveal({ host, busy, onNext, onCourse }: { host: HostView; busy: boolean; onNext: () => void; onCourse: (page: number) => void }) {
  const last = host.index + 1 >= host.total;
  return (
    <div className="space-y-8 py-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Temps écoulé · {host.challenge?.title}</p>
        <h1 className="text-3xl font-bold">Analyse de la salle</h1>
      </div>

      {host.analysis && <AnalysisBlock a={host.analysis} review={host.review} onCourse={onCourse} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {host.solution && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/60">
              <Check className="h-4 w-4 text-green-400" /> Une solution
            </p>
            <pre className="overflow-x-auto rounded-lg bg-black/30 p-4 font-mono text-sm leading-6">{host.solution}</pre>
          </div>
        )}
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/60">
            <Crown className="h-4 w-4 text-brand" /> Classement
          </p>
          <MiniBoard rows={host.leaderboard.slice(0, 6)} big />
        </div>
      </div>

      <button onClick={onNext} disabled={busy} className="inline-flex items-center gap-3 rounded-xl bg-brand px-8 py-4 text-xl font-bold shadow-lg hover:brightness-110 disabled:opacity-60">
        <SkipForward className="h-6 w-6" /> {last ? 'Voir les résultats' : 'Défi suivant'}
      </button>
    </div>
  );
}

// ───────────── Fin de séance ─────────────

function Finished({ host, onCourse, onAgain }: { host: HostView; onCourse: (page: number) => void; onAgain: () => void }) {
  const rows = host.full ?? host.leaderboard;
  const podium = rows.filter((r) => r.rank <= 3).slice(0, 3);
  // Ordre d'affichage : 2e, 1er, 3e
  const order = [podium[1], podium[0], podium[2]].filter(Boolean);
  const height = (rank: number) => (rank === 1 ? 'h-56' : rank === 2 ? 'h-40' : 'h-28');
  const hardest = [...(host.analyses ?? [])].filter((x) => x.analysis.answered > 0).sort((a, b) => a.analysis.successPct - b.analysis.successPct)[0];

  return (
    <div className="space-y-10 py-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Séance terminée</p>
        <h1 className="text-5xl font-black">Podium</h1>
      </div>

      <div className="mx-auto flex max-w-xl items-end justify-center gap-3">
        {order.map((r, i) => (
          <div key={r.pseudo} style={stagger(i, 200)} className="viz-row flex-1 text-center">
            <p className="truncate text-lg font-bold">{r.pseudo}</p>
            <p className="mb-1 text-sm tabular-nums text-white/70">{r.points} pts</p>
            <div className={`${height(r.rank)} flex items-start justify-center rounded-t-xl pt-3 text-4xl font-black ${r.rank === 1 ? 'bg-brand' : 'bg-white/20'}`}>
              {r.rank === 1 ? <Crown className="h-9 w-9" /> : r.rank}
            </div>
          </div>
        ))}
      </div>

      {hardest && (
        <section className="rounded-2xl bg-white/10 p-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Le défi le plus difficile</p>
          <h2 className="mb-5 text-2xl font-bold">{hardest.title}</h2>
          <AnalysisBlock a={hardest.analysis} review={host.review} onCourse={onCourse} />
        </section>
      )}

      <section>
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/60">Classement complet</p>
        <ol className="grid gap-x-10 gap-y-2 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.pseudo} className="flex items-center justify-between border-b border-white/10 py-1.5 text-sm">
              <span>
                <span className="mr-3 inline-block w-6 text-right text-white/50">{r.rank}</span>
                {r.pseudo}
              </span>
              <span className="tabular-nums text-white/80">
                {r.points} pts · {r.solved} défi{r.solved > 1 ? 's' : ''}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="text-center">
        <button onClick={onAgain} className="rounded-xl bg-brand px-8 py-3 text-lg font-bold hover:brightness-110">
          Nouvelle arène
        </button>
      </div>
    </div>
  );
}
