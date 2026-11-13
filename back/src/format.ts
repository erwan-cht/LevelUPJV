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
