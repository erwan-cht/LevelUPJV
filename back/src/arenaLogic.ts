// Arène live : règles de calcul (points, classement, analyse de la salle), sans accès à la base ni au réseau.
import { randomInt } from 'node:crypto';

/** Code à saisir ou à scanner : sans caractères qui se ressemblent (0/O, 1/I). */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newJoinCode = (): string => Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
export const normalizeCode = (raw: unknown): string => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

export interface Attempt {
  userId: number;
  challengeId: number;
  correct: boolean;
  failedStep: string | null;
  elapsedMs: number;
}

const BASE = 500;
const SPEED_BONUS = 500;
const WRONG_PENALTY = 50;
const FLOOR = 200;

/**
 * Points d'une bonne réponse, façon quiz en direct : 500 points pour avoir réussi, jusqu'à 500 de plus pour la rapidité,
 * 50 de moins par tentative ratée avant la bonne (jamais moins de 200).
 */
export function pointsFor(elapsedMs: number, wrongBefore: number, limitMs: number): number {
  const speed = Math.max(0, Math.min(1, 1 - elapsedMs / limitMs));
  return Math.max(FLOOR, Math.round(BASE + SPEED_BONUS * speed - WRONG_PENALTY * wrongBefore));
}

export interface ChallengeResult {
  solved: boolean;
  attempts: number;
  points: number;
  /** Temps de la première bonne réponse. */
  solvedAtMs: number | null;
}

/** Résultat d'un étudiant sur un défi : on suit ses tentatives dans l'ordre où il les a envoyées. */
export function resultOf(attempts: Attempt[], limitMs: number): ChallengeResult {
  const ordered = [...attempts].sort((a, b) => a.elapsedMs - b.elapsedMs);
  const win = ordered.findIndex((a) => a.correct);
  if (win === -1) return { solved: false, attempts: ordered.length, points: 0, solvedAtMs: null };
  return { solved: true, attempts: ordered.length, points: pointsFor(ordered[win].elapsedMs, win, limitMs), solvedAtMs: ordered[win].elapsedMs };
}

export interface BoardRow {
  userId: number;
  points: number;
  solved: number;
  rank: number;
}

/** Classement : points décroissants ; à égalité, celui qui a réussi plus de défis, puis l'ordre d'arrivée dans la salle. */
export function leaderboard(userIds: number[], attempts: Attempt[], limitMs: number): BoardRow[] {
  const byUser = new Map<number, Map<number, Attempt[]>>();
  for (const a of attempts) {
    const perChallenge = byUser.get(a.userId) ?? new Map<number, Attempt[]>();
    perChallenge.set(a.challengeId, [...(perChallenge.get(a.challengeId) ?? []), a]);
    byUser.set(a.userId, perChallenge);
  }
  const rows = userIds.map((userId, joinOrder) => {
    let points = 0;
    let solved = 0;
    for (const list of byUser.get(userId)?.values() ?? []) {
      const r = resultOf(list, limitMs);
      points += r.points;
      if (r.solved) solved++;
    }
    return { userId, points, solved, joinOrder };
  });
  rows.sort((a, b) => b.points - a.points || b.solved - a.solved || a.joinOrder - b.joinOrder);
  // Rang « à la compétition » : deux ex æquo partagent le même rang.
  const out: BoardRow[] = [];
  rows.forEach((r, i) => {
    const prev = out[i - 1];
    const tie = prev !== undefined && prev.points === r.points && prev.solved === r.solved;
    out.push({ userId: r.userId, points: r.points, solved: r.solved, rank: tie ? prev.rank : i + 1 });
  });
  return out;
}

export interface StepShare {
  step: string;
  count: number;
  /** Part des étudiants qui se sont trompés au moins une fois (0 à 100). */
  pct: number;
}

export interface Analysis {
  participants: number;
  /** Ont envoyé au moins une réponse. */
  answered: number;
  solved: number;
  /** Part des participants qui ont réussi (0 à 100). */
  successPct: number;
  /** Temps moyen de la première bonne réponse, en secondes. */
  avgSolveSec: number | null;
  /** À quelle étape de la requête les étudiants se sont d'abord trompés. */
  byStep: StepShare[];
  /** Combien n'ont jamais réussi. */
  stuck: number;
}

/**
 * Analyse de la salle sur un défi (W-03) : réussite, temps, et surtout l'étape de la requête où les étudiants butent.
 * On compte, pour chaque étudiant qui s'est trompé, l'étape de sa PREMIÈRE erreur : c'est là que la notion pose problème.
 */
export function analyse(participants: number, attempts: Attempt[], limitMs: number): Analysis {
  const byUser = new Map<number, Attempt[]>();
  for (const a of attempts) byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a]);

  let solved = 0;
  let solveMs = 0;
  const steps = new Map<string, number>();
  let wrongUsers = 0;
  for (const list of byUser.values()) {
    const ordered = [...list].sort((a, b) => a.elapsedMs - b.elapsedMs);
    const r = resultOf(ordered, limitMs);
    if (r.solved) {
      solved++;
      solveMs += r.solvedAtMs ?? 0;
    }
    const firstWrong = ordered.find((a) => !a.correct);
    if (firstWrong) {
      wrongUsers++;
      const step = firstWrong.failedStep ?? 'AUTRE';
      steps.set(step, (steps.get(step) ?? 0) + 1);
    }
  }
  const byStep = [...steps.entries()]
    .map(([step, count]) => ({ step, count, pct: wrongUsers ? Math.round((count / wrongUsers) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
  return {
    participants,
    answered: byUser.size,
    solved,
    successPct: participants ? Math.round((solved / participants) * 100) : 0,
    avgSolveSec: solved ? Math.round(solveMs / solved / 1000) : null,
    byStep,
    stuck: byUser.size - solved,
  };
}

/** Libellé d'étape (affiché à la salle) à partir du type d'étape de la visualisation SQL. */
export const STEP_LABEL: Record<string, string> = {
  from: 'FROM',
  join: 'JOIN',
  where: 'WHERE',
  group: 'GROUP BY',
  having: 'HAVING',
  select: 'SELECT',
  order: 'ORDER BY',
};
