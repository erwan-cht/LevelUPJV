export type Difficulty = 'Facile' | 'Moyen' | 'Difficile';
export type ChallengeStatus = 'en-cours' | 'recommande' | 'termine';

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
export type Subject = 'Bases de données' | 'Algorithmique' | 'Développement web' | 'Réseaux & systèmes';

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

// ---------- Duels ----------
export interface Opponent {
  name: string;
  initials: string;
  level: number;
  league: string;
  status: 'dispo' | 'en-duel';
}

export interface DuelTest {
  label: string;
  expected: string;
  passed: boolean;
}

// ---------- Profil ----------
export interface Achievement {
  id: number;
  name: string;
  description: string;
  points: number;
  claimed: boolean;
}

export interface HistoryEntry {
  title: string;
  subject: Subject;
  date: string;
  duration: string;
  points: number;
}

// ---------- Enseignant ----------
export interface Notion {
  title: string;
  subject: Subject;
  successRate: number;
  attempts: number;
}

export interface StudentToHelp {
  name: string;
  initials: string;
  info: string;
  tag: 'inactif' | 'bloqué' | 'à suivre';
}

export interface Competence {
  name: string;
  description: string;
  value: number;
}
