// Données factices : seront remplacées par les appels à l'API.
import type {
  ActivityDay,
  Badge,
  Challenge,
  DailyObjective,
  RankingEntry,
  StreakDay,
  User,
} from '../types';

export const currentUser: User = {
  firstName: 'Oscar',
  initials: 'OL',
  formation: 'BUT 2 Informatique',
  league: 'Ligue Argent',
  level: 7,
  xp: 1240,
  xpNextLevel: 1500,
  points: 2450,
  pointsToday: 60,
  promoRank: 12,
  rankDelta: 2,
};

export const challenges: Challenge[] = [
  { id: 1, title: 'Jointures et sous-requêtes', category: 'Bases de données', categoryColor: 'bg-teal-500', difficulty: 'Moyen', testsPassed: 3, testsTotal: 5, points: 80, status: 'en-cours' },
  { id: 2, title: "Tri d'un tableau", category: 'Algorithmique', categoryColor: 'bg-brand', difficulty: 'Facile', testsPassed: 0, testsTotal: 4, points: 40, status: 'en-cours' },
  { id: 3, title: 'Formulaire responsive', category: 'Développement web', categoryColor: 'bg-slate-400', difficulty: 'Difficile', testsPassed: 1, testsTotal: 5, points: 120, status: 'en-cours' },
  { id: 4, title: 'Recherche dichotomique', category: 'Algorithmique', categoryColor: 'bg-brand', difficulty: 'Facile', testsPassed: 0, testsTotal: 3, points: 40, status: 'recommande' },
  { id: 5, title: 'Agrégats et GROUP BY', category: 'Bases de données', categoryColor: 'bg-teal-500', difficulty: 'Moyen', testsPassed: 0, testsTotal: 5, points: 80, status: 'recommande' },
  { id: 6, title: 'Sélections simples', category: 'Bases de données', categoryColor: 'bg-teal-500', difficulty: 'Facile', testsPassed: 4, testsTotal: 4, points: 40, status: 'termine' },
  { id: 7, title: 'Flexbox et Grid', category: 'Développement web', categoryColor: 'bg-slate-400', difficulty: 'Facile', testsPassed: 3, testsTotal: 3, points: 40, status: 'termine' },
];

export const promoRanking: RankingEntry[] = [
  { rank: 1, name: 'Léa M.', initials: 'LM', points: 3120, delta: 1 },
  { rank: 2, name: 'Hugo B.', initials: 'HB', points: 2980, delta: 0 },
  { rank: 3, name: 'Camille D.', initials: 'CD', points: 2760, delta: -1 },
  { rank: 11, name: 'Jade H.', initials: 'JH', points: 2465, delta: -1 },
  { rank: 12, name: 'Oscar (toi)', initials: 'OL', points: 2450, delta: 2, isMe: true },
  { rank: 13, name: 'Enzo L.', initials: 'EL', points: 2420, delta: 0 },
];

export const groupRanking: RankingEntry[] = [
  { rank: 1, name: 'Hugo B.', initials: 'HB', points: 2980, delta: 0 },
  { rank: 2, name: 'Jade H.', initials: 'JH', points: 2465, delta: 1 },
  { rank: 3, name: 'Oscar (toi)', initials: 'OL', points: 2450, delta: 1, isMe: true },
  { rank: 4, name: 'Enzo L.', initials: 'EL', points: 2420, delta: -2 },
  { rank: 5, name: 'Inès R.', initials: 'IR', points: 2210, delta: 0 },
];

export const activity: ActivityDay[] = [
  { label: 'Ven', points: 0 },
  { label: 'Sam', points: 0 },
  { label: 'Dim', points: 50 },
  { label: 'Lun', points: 60 },
  { label: 'Mar', points: 120 },
  { label: 'Mer', points: 90 },
  { label: 'Auj.', points: 60, isToday: true },
];

export const badges: Badge[] = [
  { name: 'Premier pas', variant: 'navy' },
  { name: 'SQL Master', variant: 'orange' },
  { name: 'Série 5 jours', variant: 'navy' },
  { name: 'Top 10 promo', variant: 'orange' },
  { name: 'Duelliste', variant: 'locked' },
  { name: 'Full-stack', variant: 'locked' },
];

export const nextBadge = { name: 'Full-stack', progress: 2, total: 3, unit: 'matières' };

export const dailyObjectives: DailyObjective[] = [
  { label: 'Réussir 1 défi', xp: 40, done: false },
  { label: 'Gagner 50 points', xp: 30, done: true },
  { label: 'Faire 1 duel', xp: 50, done: false },
];

export const streak: StreakDay[] = [
  { label: 'L', state: 'done' },
  { label: 'M', state: 'done' },
  { label: 'M', state: 'done' },
  { label: 'J', state: 'today' },
  { label: 'V', state: 'todo' },
  { label: 'S', state: 'todo' },
  { label: 'D', state: 'todo' },
];

export const streakDays = 5;

export const onlinePlayers = [
  { initials: 'LM', color: 'bg-navy' },
  { initials: 'HB', color: 'bg-sky-500' },
  { initials: 'CD', color: 'bg-red-500' },
];
