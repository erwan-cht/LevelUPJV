export type Difficulty = 'Facile' | 'Moyen' | 'Difficile';
export type ChallengeStatus = 'en-cours' | 'recommande' | 'termine';
export type Subject = 'Bases de données' | 'Algorithmique' | 'Développement web' | 'Réseaux & systèmes';

// ---------- Tableau de bord ----------
export interface User {
  firstName: string;
  initials: string;
  formation: string;
  league: string;
  level: number;
  xp: number;
  xpNextLevel: number;
  points: number;
  pointsToday: number;
  promoRank: number;
  rankDelta: number;
}

export interface Challenge {
  id: number;
  title: string;
  category: string;
  categoryColor: string; // classe Tailwind de la pastille
  difficulty: Difficulty;
  testsPassed: number;
  testsTotal: number;
  points: number;
  status: ChallengeStatus;
}

export interface RankingEntry {
  rank: number;
  name: string;
  initials: string;
  points: number;
  delta: number; // >0 monte, <0 descend, 0 stable
  isMe?: boolean;
}

export interface ActivityDay {
  label: string;
  points: number;
  isToday?: boolean;
}

export interface Badge {
  name: string;
  variant: 'navy' | 'orange' | 'locked';
}

export interface DailyObjective {
  label: string;
  xp: number;
  done: boolean;
}

export interface StreakDay {
  label: string;
  state: 'done' | 'today' | 'todo';
}

// ---------- Catalogue de défis ----------
export interface CatalogChallenge {
  id: number;
  title: string;
  subject: Subject;
  difficulty: Difficulty;
  minutes: number;
  points: number;
  description: string;
  tests: number;
  status: 'nouveau' | 'en-cours' | 'termine';
  progress?: number; // % si en cours
  testsPassed?: number;
  recommended?: boolean;
  favorite?: boolean;
  competence?: string | null;
}

// ---------- Classement ----------
export interface Student {
  rank: number;
  name: string;
  initials: string;
  group: string;
  level: number;
  challenges: number;
  points: number;
  delta: number;
  isMe?: boolean;
}

// ---------- Profil ----------
export interface HistoryEntry {
  title: string;
  subject: Subject;
  date: string;
  duration: string;
  points: number;
}

export interface Competence {
  name: string;
  description: string;
  value: number;
}

// ---------- Réponses de l'API ----------
export interface ApiUser extends User {
  id: number;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  lastName: string;
  shortName: string;
  email: string;
  group: string | null;
  streakDays: number;
  memberSince: string;
}

export interface ApiChallenge extends CatalogChallenge {
  type: 'SQL' | 'ALGO' | 'WEB' | 'NETWORK';
}
