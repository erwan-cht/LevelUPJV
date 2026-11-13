import { useState } from 'react';
import { Flag } from 'lucide-react';
import { api, useApi } from '../api';
import PageState from '../components/PageState';
import { useMe } from '../me';
import { Breadcrumb, Card, ProgressBar, buttonOutline, buttonPrimary } from '../components/ui';

const PER_PAGE = 16;

interface Achievement {
  id: number;
  name: string;
  description: string;
  points: number;
  earned: boolean;
  claimed: boolean;
  progress: number;
  threshold: number;
}

export default function Succes() {
  const { data, setData, loading, error, reload } = useApi<{ items: Achievement[] }>('/achievements');
  const { refreshMe } = useMe();
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const claim = async (a: Achievement) => {
    setMessage(null);
    try {
      await api(`/achievements/${a.id}/claim`, { body: {} });
      setData((d) => d && { items: d.items.map((x) => (x.id === a.id ? { ...x, claimed: true } : x)) });
      setMessage(`« ${a.name} » : +${a.points} pts récupérés.`);
      refreshMe();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Impossible de réclamer ce succès.');
      void reload();
    }
  };

  const items = data?.items ?? [];
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const shown = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const earned = items.filter((a) => a.earned).length;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Tous les succès' }]} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Tous les succès</h1>
        <p className="text-sm text-muted">{earned} débloqué{earned > 1 ? 's' : ''} sur {items.length}</p>
      </div>

      {message && (
        <p role="status" className="rounded-lg bg-brand-light px-4 py-3 text-sm">
          {message}
        </p>
      )}

      <PageState loading={loading && !data} error={data ? null : error} onRetry={reload}>
        <Card>
          <ul className="grid gap-3 md:grid-cols-2">
            {shown.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-md bg-white p-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white ${!a.earned ? 'bg-slate-300' : a.claimed ? 'bg-slate-400' : 'bg-navy'}`}
                >
                  <Flag className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.name}</p>
                  <p className="text-xs">
                    <span className="text-muted">{a.description} </span>
                    <span className="font-semibold text-brand">+{a.points} pts</span>
                  </p>
                  {!a.earned && (
                    <div className="mt-1 flex items-center gap-2">
                      <ProgressBar value={a.progress} max={a.threshold} color="bg-brand" />
                      <span className="shrink-0 text-[10px] text-muted">{a.progress} / {a.threshold}</span>
                    </div>
                  )}
                </div>
                <button
                  disabled={!a.earned || a.claimed}
                  onClick={() => claim(a)}
                  className={`${buttonPrimary} px-4 py-1.5 text-xs`}
                >
                  {!a.earned ? 'Verrouillé' : a.claimed ? 'Réclamé' : 'Réclamer'}
                </button>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-5 flex items-center justify-center gap-3 text-sm">
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className={`${buttonOutline} px-3 py-1 text-xs`}>
                Précédent
              </button>
              <span className="font-semibold">Page {page}/{pages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page === pages} className={`${buttonOutline} px-3 py-1 text-xs`}>
                Suivant
              </button>
            </nav>
          )}
        </Card>
      </PageState>
    </div>
  );
}
