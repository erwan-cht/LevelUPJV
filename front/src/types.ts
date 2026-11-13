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
