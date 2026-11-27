import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { getToken, useApi } from '../api';

export interface CourseInfo {
  id: string;
  title: string;
  author: string;
  pages: number;
}

/**
 * Affiche une diapositive du cours à côté du chat. Le PDF est réservé aux utilisateurs connectés : on le télécharge avec
 * le jeton (une iframe ne peut pas l'envoyer), puis on l'affiche depuis une adresse locale à la page.
 */
export default function CoursePanel({
  course,
  page,
  onPage,
  onClose,
  onExplain,
  className = 'h-[65vh] min-h-[420px] lg:sticky lg:top-20',
}: {
  course: CourseInfo;
  page: number;
  onPage: (page: number) => void;
  onClose: () => void;
  /** Demande à l'assistant d'expliquer la diapositive affichée. */
  onExplain: (page: number) => void;
  /** Taille et position du panneau (par défaut : à côté du chat). */
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const outline = useApi<{ items: { page: number; title: string }[] }>(`/courses/${course.id}/outline`);

  useEffect(() => {
    let made: string | null = null;
    let cancelled = false;
    setUrl(null);
    setError('');
    fetch(`/api/courses/${course.id}/file`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('Le cours est introuvable.'))))
      .then((blob) => {
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Impossible de charger le cours.'));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [course.id]);

  const clamp = (n: number) => Math.min(Math.max(n, 1), course.pages);
  const current = [...(outline.data?.items ?? [])].reverse().find((o) => o.page <= page);

  return (
    <aside className={`flex flex-col overflow-hidden rounded-lg border border-brand bg-white ${className}`} aria-label="Diapositive du cours">
      <div className="flex items-center justify-between gap-2 bg-brand px-3 py-2 text-white">
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide">Cours · {course.author}</p>
        <button onClick={onClose} aria-label="Fermer le cours" className="rounded p-0.5 hover:bg-white/20">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2">
        <button onClick={() => onPage(clamp(page - 1))} disabled={page <= 1} aria-label="Diapositive précédente" className="rounded border border-slate-300 p-1 disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold">
          p. {page} / {course.pages}
        </span>
        <button onClick={() => onPage(clamp(page + 1))} disabled={page >= course.pages} aria-label="Diapositive suivante" className="rounded border border-slate-300 p-1 disabled:opacity-40">
          <ChevronRight className="h-4 w-4" />
        </button>
        {outline.data && (
          <>
            <label htmlFor="plan" className="sr-only">
              Plan du cours
            </label>
            <select
              id="plan"
              value={current?.page ?? ''}
              onChange={(e) => onPage(Number(e.target.value))}
              className="min-w-0 flex-1 truncate rounded border border-slate-300 bg-white p-1 text-xs"
            >
              {outline.data.items.map((o) => (
                <option key={o.page} value={o.page}>
                  {o.page} · {o.title}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 bg-slate-100">
        {error ? (
          <p role="alert" className="p-4 text-sm text-red-700">
            {error}
          </p>
        ) : url ? (
          // `key` : changer de page remonte la visionneuse, qui s'ouvre alors à la bonne diapositive
          <iframe key={page} src={`${url}#page=${page}&view=FitH&toolbar=0&navpanes=0`} title={`Diapositive ${page} du cours`} className="h-full w-full" />
        ) : (
          <p role="status" className="p-4 text-sm text-muted">
            Chargement du cours…
          </p>
        )}
      </div>

      <div className="border-t border-slate-200 p-2">
        <button onClick={() => onExplain(page)} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-3 py-2 text-xs font-semibold text-white">
          <Sparkles className="h-4 w-4" /> Expliquer cette diapo
        </button>
      </div>
    </aside>
  );
}
