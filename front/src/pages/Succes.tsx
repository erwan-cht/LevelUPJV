import { useState } from 'react';
import { Flag } from 'lucide-react';
import { achievements } from '../data/community';
import { Breadcrumb, Card, buttonOutline, buttonPrimary } from '../components/ui';

const PER_PAGE = 16;

export default function Succes() {
  const [page, setPage] = useState(1);
  const [claimed, setClaimed] = useState<Set<number>>(
    () => new Set(achievements.filter((a) => a.claimed).map((a) => a.id)),
  );
  const pages = Math.ceil(achievements.length / PER_PAGE);
  const items = achievements.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Tous les succès' }]} />
      <h1 className="text-2xl font-semibold">Tous les succès</h1>

      <Card>
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((a) => {
            const done = claimed.has(a.id);
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-md bg-white p-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white ${done ? 'bg-slate-400' : 'bg-navy'}`}>
                  <Flag className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.name}</p>
                  <p className="text-xs">
                    <span className="text-muted">{a.description} </span>
                    <span className="font-semibold text-brand">+{a.points} pts</span>
                  </p>
                </div>
                <button
                  disabled={done}
                  onClick={() => setClaimed((s) => new Set(s).add(a.id))}
                  className={`${buttonPrimary} px-4 py-1.5 text-xs`}
                >
                  {done ? 'Réclamé' : 'Réclamer'}
                </button>
              </li>
            );
          })}
        </ul>

        <nav aria-label="Pagination" className="mt-5 flex items-center justify-center gap-3 text-sm">
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className={`${buttonOutline} px-3 py-1 text-xs`}>
            Précédent
          </button>
          <span className="font-semibold">Page {page}/{pages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page === pages} className={`${buttonOutline} px-3 py-1 text-xs`}>
            Suivant
          </button>
        </nav>
      </Card>
    </div>
  );
}
