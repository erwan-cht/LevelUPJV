// Libellés et mises en forme partagés par les pages.

export type AccountRole = 'etudiant' | 'enseignant' | 'admin';
export type AccountStatus = 'actif' | 'suspendu' | 'en-attente';

export const roleLabel: Record<AccountRole, string> = {
  etudiant: 'Étudiant',
  enseignant: 'Enseignant',
  admin: 'Administrateur',
};

export const statusLabel: Record<AccountStatus, string> = {
  actif: 'Actif',
  suspendu: 'Suspendu',
  'en-attente': 'En attente',
};

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/** Adresse proposée à l'administrateur quand il crée un compte étudiant (il peut la modifier). */
export const emailOf = (name: string) =>
  `${name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')}@etud.u-picardie.fr`;

const pad = (n: number) => String(n).padStart(2, '0');

/** « dd/mm/yyyy ». */
export const formatDay = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** « Aujourd’hui, 09:12 », « Hier, 17:55 », « Il y a 3 jours », puis la date ; « Jamais » sans date. */
export function formatWhen(iso: string | null): string {
  if (!iso) return 'Jamais';
  const d = new Date(iso);
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const days = Math.round((startOfToday - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (days <= 0) return `Aujourd’hui, ${time}`;
  if (days === 1) return `Hier, ${time}`;
  if (days < 7) return `Il y a ${days} jours`;
  return formatDay(iso);
}

/** « 2 septembre 2026 ». */
export const formatLongDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Évolution du rang : « ▲ 2 places », « ▼ 1 place », « = stable ». */
export const rankTrend = (delta: number) =>
  delta > 0 ? `▲ ${delta} place${delta > 1 ? 's' : ''}` : delta < 0 ? `▼ ${-delta} place${delta < -1 ? 's' : ''}` : '= stable';

/** « BUT 2 Informatique » + « Groupe 1 » → « BUT 2 · Groupe 1 » (nom complet du groupe, utilisé sur les comptes). */
export const promoKey = (promoName: string, group: string) => `${promoName.replace(/ Informatique$/, '')} · ${group}`;
