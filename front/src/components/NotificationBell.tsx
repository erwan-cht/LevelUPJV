import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, Bell, Swords, Trophy } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { formatWhen } from '../format';

interface Notification {
  id: string;
  kind: 'duel-invite' | 'duel-active' | 'badges' | 'duel-result';
  text: string;
  to: string;
  at: string;
  urgent: boolean;
  /** Pour une invitation : le duel à accepter ou refuser. */
  duelId?: number;
}

const icons = { 'duel-invite': Swords, 'duel-active': Swords, badges: Award, 'duel-result': Trophy } as const;
const REFRESH_MS = 20_000;

/** Cloche de l'en-tête : invitations de duel (à accepter ici), duel en cours, succès à réclamer, derniers résultats. */
export default function NotificationBell() {
  const [data, setData] = useState<{ count: number; items: Notification[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      setData(await api<{ count: number; items: Notification[] }>('/notifications'));
    } catch {
      /* hors ligne ou API arrêtée : on garde l'affichage précédent */
    }
  }, []);

  // Relecture régulière, et à chaque changement de page (une action a pu traiter une notification).
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load, pathname]);

  // Fermeture au clic en dehors de la liste.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  /** Accepte (et ouvre le duel) ou refuse une invitation, sans quitter la page. */
  const answer = async (duelId: number, action: 'accept' | 'decline') => {
    setBusy(duelId);
    setError(null);
    try {
      await api(`/duels/${duelId}/${action}`, { body: {} });
      if (action === 'accept') {
        setOpen(false);
        navigate(`/duels/${duelId}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const count = data?.count ?? 0;
  const items = data?.items ?? [];

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setError(null);
          void load();
        }}
        aria-label={count > 0 ? `Notifications : ${count} à traiter` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-navy hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-80 overflow-hidden rounded-md border border-slate-200 bg-white text-sm shadow-lg">
          <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Notifications</p>
          {error && (
            <p role="alert" className="border-b border-slate-100 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          )}
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted">Aucune notification pour le moment.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) =>
                n.kind === 'duel-invite' && n.duelId ? (
                  <li key={n.id} className="px-3 py-2.5">
                    <Row n={n} />
                    <div className="mt-2 flex gap-2 pl-10">
                      <button
                        type="button"
                        onClick={() => answer(n.duelId!, 'accept')}
                        disabled={busy !== null}
                        className="rounded bg-brand px-3 py-1 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-50"
                      >
                        {busy === n.duelId ? '…' : 'Accepter'}
                      </button>
                      <button
                        type="button"
                        onClick={() => answer(n.duelId!, 'decline')}
                        disabled={busy !== null}
                        className="rounded border border-slate-300 px-3 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                      >
                        Refuser
                      </button>
                    </div>
                  </li>
                ) : (
                  <li key={n.id}>
                    <Link to={n.to} onClick={() => setOpen(false)} className={`block px-3 py-2.5 hover:bg-slate-50 ${n.urgent ? '' : 'opacity-75'}`}>
                      <Row n={n} />
                    </Link>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ n }: { n: Notification }) {
  const Icon = icons[n.kind];
  return (
    <span className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${n.urgent ? 'bg-brand-light text-brand' : 'bg-slate-100 text-muted'}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-xs ${n.urgent ? 'font-semibold' : ''}`}>{n.text}</span>
        <span className="block text-[10px] text-muted">{formatWhen(n.at)}</span>
      </span>
      {n.urgent && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="À traiter" />}
    </span>
  );
}
