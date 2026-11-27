import { useState } from 'react';
import { Play, Swords } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useApi } from '../api';
import { Breadcrumb, PageTitle } from '../components/ui';

interface Item {
  id: number;
  title: string;
  difficulty: string;
  minutes: number;
}

const LIMITS = [
  { sec: 120, label: '2 min' },
  { sec: 180, label: '3 min' },
  { sec: 240, label: '4 min' },
  { sec: 300, label: '5 min' },
  { sec: 480, label: '8 min' },
];

/** Préparation d'une arène : choix des défis et du temps, puis ouverture de la salle. */
export default function ArenaLauncher() {
  const navigate = useNavigate();
  const list = useApi<{ items: Item[] }>('/arena/challenges');
  const open = useApi<{ items: { code: string; status: string; participants: number; challenges: number }[] }>('/arena/mine');
  const [picked, setPicked] = useState<number[]>([]);
  const [limit, setLimit] = useState(240);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 8 ? [...p, id] : p));

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api<{ code: string }>('/arena', { body: { challengeIds: picked, timeLimitSec: limit } });
      navigate(`/enseignant/arene/${res.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible.');
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/enseignant' }, { label: 'Arène live' }]} />
      <PageTitle title="Arène live" subtitle="Lance une séance en amphi : les étudiants rejoignent avec un QR code, résolvent les mêmes défis en même temps et le classement s’affiche en direct." />

      {open.data && open.data.items.length > 0 && (
        <section className="rounded-lg border border-brand bg-brand-light p-4">
          <p className="mb-2 text-sm font-semibold">Séance en cours</p>
          <ul className="space-y-2">
            {open.data.items.map((s) => (
              <li key={s.code} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="mr-2 rounded bg-brand px-2 py-0.5 font-bold tracking-widest text-white">{s.code}</span>
                  {s.participants} joueur(s) · {s.challenges} défi(s)
                </span>
                <Link to={`/enseignant/arene/${s.code}`} className="font-semibold text-brand hover:underline">
                  Reprendre l’écran
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-5 rounded-lg border border-navy bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide">1. Choisis les défis (dans l’ordre où tu les cliques)</h2>
          {list.loading && <p className="mt-2 text-sm text-muted">Chargement…</p>}
          {list.error && <p role="alert" className="mt-2 text-sm text-red-700">{list.error}</p>}
          {list.data && list.data.items.length === 0 && <p className="mt-2 text-sm text-muted">Aucun défi SQL publié et corrigé automatiquement.</p>}
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {list.data?.items.map((c) => {
              const n = picked.indexOf(c.id) + 1;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => toggle(c.id)}
                    aria-pressed={n > 0}
                    className={`flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left text-sm ${n > 0 ? 'border-brand bg-brand-light' : 'border-slate-200 hover:border-slate-400'}`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${n > 0 ? 'bg-brand text-white' : 'bg-slate-200'}`}>{n > 0 ? n : ''}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted">{c.difficulty}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold uppercase tracking-wide">2. Temps par défi</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {LIMITS.map((l) => (
              <button
                key={l.sec}
                onClick={() => setLimit(l.sec)}
                aria-pressed={limit === l.sec}
                className={`rounded-md border px-4 py-1.5 text-sm font-semibold ${limit === l.sec ? 'border-navy bg-navy text-white' : 'border-slate-300'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <button onClick={create} disabled={busy || picked.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-base font-bold text-white disabled:opacity-50">
          {busy ? <Swords className="h-5 w-5 animate-pulse" /> : <Play className="h-5 w-5" />} Ouvrir la salle ({picked.length} défi{picked.length > 1 ? 's' : ''})
        </button>
      </section>
    </div>
  );
}
