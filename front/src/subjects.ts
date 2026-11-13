// Apparence des matières et des ligues (couleurs, abréviations). Ce sont des réglages d'affichage :
// les données (défis, points, classements) viennent de l'API.
import type { Subject } from './types';

export const subjectStyles: Record<
  Subject,
  { short: string; bar: string; text: string; border: string; soft: string; dot: string }
> = {
  'Bases de données': { short: 'BDD', bar: 'bg-sky-600', text: 'text-sky-700', border: 'border-sky-600', soft: 'bg-sky-100', dot: 'bg-sky-600' },
  Algorithmique: { short: 'ALGO', bar: 'bg-brand', text: 'text-brand', border: 'border-brand', soft: 'bg-brand-light', dot: 'bg-brand' },
  'Développement web': { short: 'WEB', bar: 'bg-navy', text: 'text-navy', border: 'border-navy', soft: 'bg-slate-200', dot: 'bg-navy' },
  'Réseaux & systèmes': { short: 'RÉSEAUX', bar: 'bg-red-600', text: 'text-red-600', border: 'border-red-600', soft: 'bg-red-100', dot: 'bg-red-600' },
};

export const subjects = Object.keys(subjectStyles) as Subject[];

/** Couleur de la pastille de chaque ligue (les seuils de points viennent de l'API). */
export const leagueColors: Record<string, string> = {
  Diamant: 'bg-sky-300',
  Platine: 'bg-slate-300',
  Or: 'bg-yellow-400',
  Argent: 'bg-slate-400',
  Bronze: 'bg-amber-700',
};
