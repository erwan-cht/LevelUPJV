// Conversions entre la base (énumérations anglaises, valeurs brutes) et ce qu'attend le front.

export const LEVEL_XP = 200;
export const levelOf = (xp: number) => Math.floor(xp / LEVEL_XP) + 1;
export const nextLevelXp = (xp: number) => levelOf(xp) * LEVEL_XP;

const LEAGUES = [
  { name: 'Diamant', min: 5000 },
  { name: 'Platine', min: 4000 },
  { name: 'Or', min: 3000 },
  { name: 'Argent', min: 2000 },
  { name: 'Bronze', min: 0 },
];
export const leagueOf = (points: number) => (LEAGUES.find((l) => points >= l.min) ?? LEAGUES[4]).name;

export const subjectLabel: Record<string, string> = {
  DATABASES: 'Bases de données',
  ALGORITHMICS: 'Algorithmique',
  WEB_DEV: 'Développement web',
  NETWORKS_SYSTEMS: 'Réseaux & systèmes',
};

export const difficultyLabel: Record<string, string> = {
  EASY: 'Facile',
  MEDIUM: 'Moyen',
  HARD: 'Difficile',
};

export const roleLabel: Record<string, 'etudiant' | 'enseignant' | 'admin'> = {
  STUDENT: 'etudiant',
  TEACHER: 'enseignant',
  ADMIN: 'admin',
};

export const initials = (firstName: string, lastName: string) =>
  `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

/** Énoncé Markdown -> courte description sans mise en forme. */
export const shortDescription = (statement: string) => {
  const plain = statement.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > 110 ? `${plain.slice(0, 107)}…` : plain;
};

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// ───────────── Compléments : libellés ↔ valeurs de la base ─────────────

export const LEAGUE_LIST = LEAGUES;

export const subjectFromLabel: Record<string, 'DATABASES' | 'ALGORITHMICS' | 'WEB_DEV' | 'NETWORKS_SYSTEMS'> = {
  'Bases de données': 'DATABASES',
  Algorithmique: 'ALGORITHMICS',
  'Développement web': 'WEB_DEV',
  'Réseaux & systèmes': 'NETWORKS_SYSTEMS',
};

export const difficultyFromLabel: Record<string, 'EASY' | 'MEDIUM' | 'HARD'> = {
  Facile: 'EASY',
  Moyen: 'MEDIUM',
  Difficile: 'HARD',
};

export const roleFromFront: Record<string, 'STUDENT' | 'TEACHER' | 'ADMIN'> = {
  etudiant: 'STUDENT',
  enseignant: 'TEACHER',
  admin: 'ADMIN',
};

export const statusToFront: Record<string, 'actif' | 'suspendu' | 'en-attente'> = {
  ACTIVE: 'actif',
  SUSPENDED: 'suspendu',
  PENDING: 'en-attente',
};

export const statusFromFront: Record<string, 'ACTIVE' | 'SUSPENDED' | 'PENDING'> = {
  actif: 'ACTIVE',
  suspendu: 'SUSPENDED',
  'en-attente': 'PENDING',
};

export const contentToFront: Record<string, 'publie' | 'brouillon' | 'masque'> = {
  PUBLISHED: 'publie',
  DRAFT: 'brouillon',
  HIDDEN: 'masque',
};

export const contentFromFront: Record<string, 'PUBLISHED' | 'DRAFT' | 'HIDDEN'> = {
  publie: 'PUBLISHED',
  brouillon: 'DRAFT',
  masque: 'HIDDEN',
};

/** Type de défi par défaut pour un défi « tests » (code) selon la matière. */
export const typeForSubject: Record<string, 'SQL' | 'ALGO' | 'WEB' | 'NETWORK'> = {
  DATABASES: 'ALGO',
  ALGORITHMICS: 'ALGO',
  WEB_DEV: 'WEB',
  NETWORKS_SYSTEMS: 'NETWORK',
};

const PALETTE = ['bg-navy', 'bg-sky-500', 'bg-red-500', 'bg-teal-600', 'bg-violet-500', 'bg-slate-500'];
export const colorFor = (id: number) => PALETTE[id % PALETTE.length];

export const shortName = (firstName: string, lastName: string) => `${firstName} ${lastName[0] ?? ''}.`.trim();
export const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

/** « BUT 2 · Groupe 2 » -> « Groupe 2 ». */
export const groupShort = (name: string) => name.split(' · ').pop() ?? name;
/** « BUT 2 Informatique » -> « BUT 2 » (valeur de Group.promo). */
export const promoCodeOf = (name: string) => name.replace(/ Informatique$/, '').trim();

export const ONLINE_MS = 5 * 60_000;
export const isOnline = (d: Date | null | undefined) => Boolean(d && Date.now() - d.getTime() < ONLINE_MS);

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
/** Mot de passe temporaire lisible (sans caractères ambigus). */
export const randomPassword = (length = 10) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
};

export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Unités affichées pour la progression vers un badge. */
export const metricUnit: Record<string, string> = {
  PASSED_TOTAL: 'défis',
  PASSED_DATABASES: 'défis BDD',
  PASSED_ALGORITHMICS: 'défis algo',
  PASSED_WEB_DEV: 'défis web',
  PASSED_NETWORKS_SYSTEMS: 'défis réseaux',
  STREAK: 'jours',
  DUELS_WON: 'duels',
  SUBJECTS_DONE: 'matières',
  FIRST_TRY: 'défis du 1er coup',
  NIGHT_PASSES: 'défis de nuit',
};
