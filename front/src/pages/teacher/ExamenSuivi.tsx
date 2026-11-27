import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Lock, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { api } from '../../api';
import { Breadcrumb, Card, CardTitle, buttonBrand, buttonOutline, buttonPrimary } from '../../components/ui';
import { formatClock, useCountdown, useStream } from '../../stream';

type SeatStatus = 'ACTIVE' | 'LOCKED' | 'EXCLUDED' | 'SUBMITTED';

interface Seat {
  userId: number;
  name: string;
  pseudo: string;
  status: SeatStatus;
  leaveCount: number;
  lockedAt: string | null;
  lockReason: string | null;
  answered: number;
  correct: number;
  grade: number;
  online: boolean;
}

interface ExamEvent {
  id: number;
  kind: 'JOIN' | 'LEAVE' | 'UNLOCK' | 'EXCLUDE' | 'SUBMIT';
  detail: string;
  name: string;
  userId: number;
  at: string;
}

interface HostView {
  code: string;
  title: string;
  status: 'LOBBY' | 'RUNNING' | 'FINISHED';
  durationMin: number;
  total: number;
  serverNow: number;
  endsAt: number | null;
  challenges: { id: number; title: string }[];
  seats: Seat[];
  events: ExamEvent[];
}

const SEAT: Record<SeatStatus, { label: string; cls: string }> = {
  ACTIVE: { label: 'Compose', cls: 'bg-green-100 text-green-800' },
  LOCKED: { label: 'Bloqué', cls: 'bg-red-600 text-white' },
  EXCLUDED: { label: 'Copie close', cls: 'bg-slate-600 text-white' },
  SUBMITTED: { label: 'A rendu', cls: 'bg-navy text-white' },
};

const EVENT: Record<ExamEvent['kind'], string> = {
  JOIN: 'est entré dans l’examen',
  LEAVE: '',
  UNLOCK: 'a été débloqué',
  EXCLUDE: 'copie close',
  SUBMIT: 'a rendu sa copie',
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const since = (iso: string | null, now: number) => {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  return s < 60 ? `il y a ${s} s` : `il y a ${Math.floor(s / 60)} min`;
};

/** Petit signal sonore, sans fichier audio. */
function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
    o.onended = () => void ctx.close();
  } catch {
    /* audio indisponible */
  }
}

const notifSupported = typeof window !== 'undefined' && 'Notification' in window;

export default function ExamenSuivi() {
  const { code = '' } = useParams();
  const { data, error, connected } = useStream<HostView>(`/exams/${code.toUpperCase()}/stream`);
  const remaining = useCountdown(data?.status === 'RUNNING' ? data.endsAt : null, data?.serverNow);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [sound, setSound] = useState(true);
  const [perm, setPerm] = useState(notifSupported ? Notification.permission : 'denied');
  const [toasts, setToasts] = useState<ExamEvent[]>([]);
  const [copy, setCopy] = useState<{ seat: Seat; items: { challengeId: number; title: string; answer: string; correct: boolean }[] } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  // ── Alertes : chaque nouvelle sortie de page produit une notification (bandeau, son, notification système).
  const lastSeen = useRef<number | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  useEffect(() => {
    if (!data) return;
    const maxId = data.events.reduce((m, e) => Math.max(m, e.id), 0);
    if (lastSeen.current === null) {
      lastSeen.current = maxId; // ce qui s'est passé avant l'ouverture de la page n'est pas une nouveauté
      return;
    }
    const fresh = data.events.filter((e) => e.id > lastSeen.current! && e.kind === 'LEAVE').reverse();
    lastSeen.current = Math.max(lastSeen.current, maxId);
    if (!fresh.length) return;
    setToasts((t) => [...t, ...fresh]);
    if (soundRef.current) beep();
    if (notifSupported && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      for (const e of fresh) new Notification(`${e.name} a quitté l’examen`, { body: `${e.detail}. Sa copie est bloquée.`, tag: `exam-${e.userId}` });
    }
  }, [data]);

  // Les bandeaux disparaissent quand l'étudiant n'est plus bloqué (décision prise ici ou ailleurs).
  const lockedIds = new Set(data?.seats.filter((s) => s.status === 'LOCKED').map((s) => s.userId));
  const visibleToasts = toasts.filter((t) => lockedIds.has(t.userId));
  const lockedCount = lockedIds.size;

  useEffect(() => {
    const base = data ? `Examen ${data.code}` : 'Examen';
    document.title = lockedCount ? `(${lockedCount}) Bloqué${lockedCount > 1 ? 's' : ''} · ${base}` : base;
    return () => {
      document.title = 'LevelUPJV';
    };
  }, [lockedCount, data]);

  if (!data) {
    return (
      <p role={error ? 'alert' : 'status'} className={`rounded-lg p-6 text-center text-sm ${error ? 'bg-red-50 text-red-800' : 'bg-panel text-muted'}`}>
        {error ?? 'Connexion à l’examen…'}
      </p>
    );
  }

  const act = async (key: string, path: string) => {
    setBusy(key);
    setActionError(null);
    try {
      await api(`/exams/${data.code}${path}`, { body: {} });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy(null);
    }
  };
  const unlock = (s: Seat) => act(`u${s.userId}`, `/seats/${s.userId}/unlock`);
  const exclude = (s: Seat) => act(`x${s.userId}`, `/seats/${s.userId}/exclude`);

  const openCopy = async (seat: Seat) => {
    try {
      const r = await api<{ items: { challengeId: number; title: string; answer: string; correct: boolean }[] }>(`/exams/${data.code}/seats/${seat.userId}`);
      setCopy({ seat, items: r.items });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Copie indisponible.');
    }
  };

  const askPermission = async () => {
    if (!notifSupported) return;
    setPerm(await Notification.requestPermission());
  };

  const exportCsv = () => {
    const rows = [['Nom', 'Pseudo', 'Statut', 'Sorties de page', 'Défis enregistrés', 'Défis réussis', 'Note /20']];
    for (const s of data.seats) rows.push([s.name, s.pseudo, SEAT[s.status].label, String(s.leaveCount), String(s.answered), `${s.correct}/${data.total}`, String(s.grade).replace('.', ',')]);
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `examen-${data.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const locked = data.seats.filter((s) => s.status === 'LOCKED');
  const counts = { ACTIVE: 0, LOCKED: 0, EXCLUDED: 0, SUBMITTED: 0 } as Record<SeatStatus, number>;
  for (const s of data.seats) counts[s.status]++;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Examens', to: '/enseignant/examens' }, { label: data.title }]} />

      {/* Bandeaux d'alerte en direct */}
      <div className="fixed right-4 top-20 z-40 w-80 space-y-2" aria-live="assertive">
        {visibleToasts.slice(-4).map((t) => {
          const seat = data.seats.find((s) => s.userId === t.userId);
          return (
            <div key={t.id} role="alert" className="rounded-lg border-l-4 border-red-600 bg-white p-3 text-sm shadow-lg">
              <div className="flex items-start gap-2">
                <Lock size={16} className="mt-0.5 shrink-0 text-red-600" />
                <div className="flex-1">
                  <p className="font-semibold">{t.name} a quitté l’examen</p>
                  <p className="text-xs text-muted">{t.detail} · {time(t.at)}</p>
                </div>
                <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Masquer l’alerte" className="text-muted hover:text-navy"><X size={14} /></button>
              </div>
              {seat && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => unlock(seat)} disabled={!!busy} className={`${buttonBrand} px-3 py-1 text-xs`}>Débloquer</button>
                  <button onClick={() => exclude(seat)} disabled={!!busy} className="rounded-md border border-red-600 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Laisser bloqué et clore</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* En-tête : code, état, minuteur, commandes */}
      <section className="flex flex-wrap items-center gap-5 rounded-lg bg-navy p-5 text-white">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-300">Code à donner aux étudiants</p>
          <p className="font-mono text-4xl font-bold tracking-[0.25em]">{data.code}</p>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{data.title}</h1>
          <p className="text-sm text-slate-300">
            {data.total} défi{data.total > 1 ? 's' : ''} · {data.durationMin} min · {data.seats.length} étudiant{data.seats.length > 1 ? 's' : ''}
            {!connected && <span className="ml-2 font-semibold text-red-300">· connexion perdue, reconnexion…</span>}
          </p>
        </div>
        {data.status === 'RUNNING' && remaining !== null && (
          <div className="text-center">
            <p className="font-mono text-4xl font-bold tabular-nums">{formatClock(remaining)}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-300">Temps restant</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {data.status === 'LOBBY' && (
            <button onClick={() => act('start', '/start')} disabled={!!busy || data.seats.length === 0} className={buttonBrand}>Lancer l’examen</button>
          )}
          {data.status === 'RUNNING' &&
            (confirmEnd ? (
              <>
                <button onClick={() => void act('finish', '/finish').then(() => setConfirmEnd(false))} disabled={!!busy} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Terminer maintenant</button>
                <button onClick={() => setConfirmEnd(false)} className="rounded-md border border-white px-4 py-2 text-sm">Annuler</button>
              </>
            ) : (
              <button onClick={() => setConfirmEnd(true)} className="rounded-md border border-white px-4 py-2 text-sm hover:bg-white/10">Terminer l’examen</button>
            ))}
          {data.status === 'FINISHED' && <span className="rounded bg-slate-500 px-2 py-1 text-xs font-bold uppercase">Terminé</span>}
        </div>
      </section>

      {/* Réglages des alertes */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button onClick={() => setSound((s) => !s)} className="inline-flex items-center gap-1.5 rounded-md bg-panel px-3 py-1.5 hover:bg-slate-200">
          {sound ? <Bell size={14} /> : <BellOff size={14} />} Son des alertes : {sound ? 'activé' : 'coupé'}
        </button>
        {notifSupported && perm === 'default' && (
          <button onClick={askPermission} className="rounded-md bg-panel px-3 py-1.5 font-semibold text-brand hover:bg-slate-200">Recevoir aussi les alertes hors de cet onglet</button>
        )}
        {perm === 'granted' && <span className="text-muted">Notifications du navigateur activées</span>}
        {perm === 'denied' && notifSupported && <span className="text-muted">Notifications du navigateur refusées : gardez cet onglet visible.</span>}
        <span className="ml-auto text-muted">
          {counts.ACTIVE} composent · {counts.LOCKED} bloqués · {counts.SUBMITTED} ont rendu · {counts.EXCLUDED} copies closes
        </span>
      </div>

      {actionError && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</p>}

      {data.status === 'LOBBY' && (
        <Card>
          <p className="text-sm">
            Affichez le code au tableau. Les étudiants vont dans <strong>Examen</strong> (menu de leur espace) et saisissent <span className="font-mono font-bold">{data.code}</span>.
            Lancez l’examen quand tout le monde est entré : les sujets s’affichent alors chez eux, et la surveillance commence.
          </p>
        </Card>
      )}

      {/* Étudiants en attente d'une décision */}
      {locked.length > 0 && (
        <section className="rounded-lg border-2 border-red-600 bg-red-50 p-4">
          <h2 className="flex items-center gap-2 font-semibold text-red-800"><Lock size={16} /> En attente de votre décision ({locked.length})</h2>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {locked.map((s) => (
              <li key={s.userId} className="flex flex-wrap items-center gap-3 rounded-md bg-white p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted">
                    {s.lockReason} · {since(s.lockedAt, now)} · {s.leaveCount} sortie{s.leaveCount > 1 ? 's' : ''} au total
                  </p>
                </div>
                <button onClick={() => unlock(s)} disabled={!!busy} className={`${buttonBrand} px-3 py-1.5 text-xs`}>Débloquer</button>
                <button onClick={() => exclude(s)} disabled={!!busy} className="rounded-md border border-red-600 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">Clore la copie</button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-800">Sans décision, l’étudiant reste bloqué. Ses réponses enregistrées avant la sortie restent comptées.</p>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Card className="min-w-0">
          <div className="flex items-center justify-between">
            <CardTitle>Salle</CardTitle>
            {data.status === 'FINISHED' && <button onClick={exportCsv} className={`${buttonOutline} px-3 py-1.5 text-xs`}>Exporter les résultats (CSV)</button>}
          </div>
          {data.seats.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Personne n’est encore entré.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">Étudiant</th>
                    <th className="py-2 pr-3 font-semibold">État</th>
                    <th className="py-2 pr-3 font-semibold">Sorties</th>
                    <th className="py-2 pr-3 font-semibold">Enregistrés</th>
                    <th className="py-2 pr-3 font-semibold">Réussis</th>
                    <th className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.seats.map((s) => (
                    <tr key={s.userId} className={`border-t border-slate-200 ${s.status === 'LOCKED' ? 'bg-red-50' : ''}`}>
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${s.online ? 'bg-green-500' : 'bg-slate-300'}`} title={s.online ? 'Page ouverte' : 'Page fermée'} />
                          <span>
                            <span className="font-medium">{s.name}</span>
                            <span className="block text-[11px] text-muted">{s.pseudo}{!s.online && data.status !== 'FINISHED' && s.status !== 'SUBMITTED' ? ' · page fermée' : ''}</span>
                          </span>
                        </span>
                      </td>
                      <td className="py-2 pr-3"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${SEAT[s.status].cls}`}>{SEAT[s.status].label}</span></td>
                      <td className={`py-2 pr-3 tabular-nums ${s.leaveCount > 0 ? 'font-semibold text-red-700' : ''}`}>{s.leaveCount}</td>
                      <td className="py-2 pr-3 tabular-nums">{s.answered} / {data.total}</td>
                      <td className="py-2 pr-3 tabular-nums">{s.correct} / {data.total} <span className="text-xs text-muted">({s.grade}/20)</span></td>
                      <td className="py-2 text-right">
                        <span className="inline-flex gap-1.5">
                          {data.status === 'RUNNING' && s.status === 'EXCLUDED' && (
                            <button onClick={() => unlock(s)} disabled={!!busy} className="rounded border border-navy px-2 py-1 text-[11px] hover:bg-slate-100">Débloquer</button>
                          )}
                          {data.status === 'RUNNING' && s.status === 'LOCKED' && (
                            <button onClick={() => unlock(s)} disabled={!!busy} className="rounded bg-brand px-2 py-1 text-[11px] font-semibold text-white">Débloquer</button>
                          )}
                          <button onClick={() => void openCopy(s)} className="rounded border border-slate-300 px-2 py-1 text-[11px] hover:bg-slate-100">Copie</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Journal</CardTitle>
          {data.events.length === 0 ? (
            <p className="mt-3 text-xs text-muted">Rien pour l’instant.</p>
          ) : (
            <ul className="mt-3 max-h-[28rem] space-y-1.5 overflow-y-auto text-xs">
              {data.events.map((e) => (
                <li key={e.id} className={`rounded px-3 py-2 ${e.kind === 'LEAVE' ? 'bg-red-50 text-red-900' : 'bg-white'}`}>
                  <span className="font-mono text-muted">{time(e.at)}</span> <strong>{e.name}</strong> {e.kind === 'LEAVE' ? e.detail : EVENT[e.kind]}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {copy && (
        <div role="dialog" aria-modal="true" aria-labelledby="copy-title" className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4" onClick={() => setCopy(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 id="copy-title" className="text-lg font-semibold">Copie de {copy.seat.name}</h2>
              <button onClick={() => setCopy(null)} aria-label="Fermer" className="text-muted hover:text-navy"><X size={18} /></button>
            </div>
            <ul className="mt-4 space-y-3">
              {data.challenges.map((c, i) => {
                const a = copy.items.find((x) => x.challengeId === c.id);
                return (
                  <li key={c.id} className="rounded-md bg-panel p-3">
                    <p className="flex items-center justify-between text-sm font-medium">
                      <span>{i + 1}. {c.title}</span>
                      {a && <span className={`text-xs font-semibold ${a.correct ? 'text-green-700' : 'text-red-700'}`}>{a.correct ? 'Réussi' : 'Incorrect'}</span>}
                    </p>
                    {a ? <pre className="mt-2 overflow-x-auto rounded bg-[#1b2238] p-3 font-mono text-xs text-slate-100">{a.answer}</pre> : <p className="mt-1 text-xs text-muted">Pas de réponse enregistrée.</p>}
                  </li>
                );
              })}
            </ul>
            <button onClick={() => setCopy(null)} className={`${buttonPrimary} mt-4`}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
