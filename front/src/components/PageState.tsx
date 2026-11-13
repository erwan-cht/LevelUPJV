import type { ReactNode } from 'react';
import { buttonOutline } from './ui';

/** Affiche l'état de chargement ou d'erreur d'une page branchée sur l'API. */
export default function PageState({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (error) {
    return (
      <div role="alert" className="space-y-3 rounded-lg bg-red-50 p-6 text-sm text-red-800">
        <p>{error}</p>
        <button onClick={onRetry} className={buttonOutline}>
          Réessayer
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <p role="status" className="rounded-lg bg-panel p-6 text-center text-sm text-muted">
        Chargement…
      </p>
    );
  }
  return <>{children}</>;
}
