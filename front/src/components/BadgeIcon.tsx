import { Star } from 'lucide-react';

/** Badges disposant d'une illustration dans public/badges/<slug>.webp. */
const ILLUSTRATED = new Set(['premier-pas', 'sql-master', 'serie-5-jours', 'top-10-promo', 'duelliste', 'full-stack']);

/**
 * Pastille d'un badge : illustration si elle existe, sinon étoile sur fond de couleur.
 * Un badge verrouillé est affiché en niveaux de gris et atténué.
 */
export default function BadgeIcon({
  slug,
  locked = false,
  color = 'bg-navy',
  size = 'h-12 w-12',
}: {
  slug?: string;
  locked?: boolean;
  color?: string;
  size?: string;
}) {
  const title = locked ? 'Pas encore débloqué' : undefined;

  if (slug && ILLUSTRATED.has(slug)) {
    return (
      <img
        src={`/badges/${slug}.webp`}
        alt=""
        title={title}
        className={`${size} rounded-full ${locked ? 'opacity-40 grayscale' : ''}`}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className={`flex ${size} items-center justify-center rounded-full ${locked ? 'bg-slate-300' : color}`}
      title={title}
    >
      <Star className="h-1/2 w-1/2 fill-white text-white" />
    </span>
  );
}
