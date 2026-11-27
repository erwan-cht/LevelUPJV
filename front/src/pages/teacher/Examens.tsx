import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useApi } from '../../api';
import PageState from '../../components/PageState';
import { Card, CardTitle, PageTitle, buttonPrimary, inputClass } from '../../components/ui';

interface Playable {
  id: number;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  minutes: number;
}

interface MyExam {
  code: string;
  title: string;
  status: 'LOBBY' | 'RUNNING' | 'FINISHED';
  durationMin: number;
  createdAt: string;
  participants: number;
  challenges: number;
}

const DIFF = { EASY: 'Facile', MEDIUM: 'Moyen', HARD: 'Difficile' } as const;
const STATUS = { LOBBY: 'En attente', RUNNING: 'En cours', FINISHED: 'Terminé' } as const;
const MAX = 10;

export default function Examens() {
  const navigate = useNavigate();
  const pool = useApi<{ items: Playable[] }>('/exams/challenges');
  const mine = useApi<{ items: MyExam[] }>('/exams/mine');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX ? [...p, id] : p));
  const suggested = picked.reduce((n, id) => n + (pool.data?.items.find((c) => c.id === id)?.minutes ?? 0), 0);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ code: string }>('/exams', { body: { title, durationMin: duration, challengeIds: picked } });
      navigate(`/enseignant/examens/${res.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageTitle title="Examens surveillés" subtitle="Les étudiants entrent avec un code. Quitter la page bloque leur copie, et vous décidez de les débloquer ou non." />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardTitle>Nouvel examen</CardTitle>
          <form onSubmit={create} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Titre</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contrôle SQL — jointures" maxLength={120} className={inputClass} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Durée (min)</span>
                <input type="number" min={5} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputClass} />
              </label>
            </div>

            <div>
              <p className="text-sm font-medium">
                Défis ({picked.length} / {MAX}){suggested > 0 && <span className="font-normal text-muted"> · durée estimée : {suggested} min</span>}
              </p>
              <PageState loading={pool.loading} error={pool.error} onRetry={() => void pool.reload()}>
                {pool.data?.items.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">Aucun défi SQL publié avec correction automatique.</p>
                ) : (
                  <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto rounded-md bg-white p-2">
                    {pool.data?.items.map((c) => {
                      const pos = picked.indexOf(c.id);
                      return (
                        <li key={c.id}>
                          <label className={`flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-slate-50 ${pos >= 0 ? 'bg-brand-light' : ''}`}>
                            <input type="checkbox" checked={pos >= 0} onChange={() => toggle(c.id)} className="accent-[#ef8a0e]" />
                            <span className="w-5 text-xs font-semibold text-brand">{pos >= 0 ? pos + 1 : ''}</span>
                            <span className="flex-1">{c.title}</span>
                            <span className="text-xs text-muted">{DIFF[c.difficulty]} · {c.minutes} min</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </PageState>
            </div>

            {error && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            <button type="submit" disabled={busy || picked.length === 0} className={buttonPrimary}>Créer l’examen et obtenir le code</button>
            <p className="text-xs text-muted">L’examen démarre quand vous cliquez sur « Lancer », une fois les étudiants entrés.</p>
          </form>
        </Card>

        <Card>
          <CardTitle>Mes examens</CardTitle>
          <PageState loading={mine.loading} error={mine.error} onRetry={() => void mine.reload()}>
            {mine.data?.items.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Aucun examen pour l’instant.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {mine.data?.items.map((x) => (
                  <li key={x.code}>
                    <Link to={`/enseignant/examens/${x.code}`} className="block rounded-md bg-white px-3 py-2 text-sm hover:ring-2 hover:ring-brand/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{x.title}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white ${x.status === 'RUNNING' ? 'bg-red-600' : x.status === 'LOBBY' ? 'bg-brand' : 'bg-slate-500'}`}>
                          {STATUS[x.status]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        <span className="font-mono">{x.code}</span> · {x.challenges} défi{x.challenges > 1 ? 's' : ''} · {x.durationMin} min · {x.participants} étudiant{x.participants > 1 ? 's' : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PageState>
        </Card>
      </div>
    </div>
  );
}
