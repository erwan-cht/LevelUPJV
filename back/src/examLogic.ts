// Examen surveillé : règles (durée, qui peut composer, blocage / déblocage, notes), sans accès à la base ni au réseau.

export type ExamStatus = 'LOBBY' | 'RUNNING' | 'FINISHED';
export type SeatStatus = 'ACTIVE' | 'LOCKED' | 'EXCLUDED' | 'SUBMITTED';

export const MIN_DURATION = 5;
export const MAX_DURATION = 240;
export const MAX_CHALLENGES = 10;

/** Durée demandée par l'enseignant, ramenée dans les bornes (60 min par défaut). */
export const clampDuration = (raw: unknown): number => {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return 60;
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, n));
};

/** Heure de fin de l'examen (ms), ou null s'il n'a pas commencé. */
export const endsAtOf = (startedAt: Date | null, durationMin: number): number | null =>
  startedAt ? startedAt.getTime() + durationMin * 60_000 : null;

/** L'examen est en cours mais son temps est écoulé : il doit être clos. */
export const isOverdue = (status: ExamStatus, startedAt: Date | null, durationMin: number, now: number): boolean => {
  const end = endsAtOf(startedAt, durationMin);
  return status === 'RUNNING' && end !== null && now >= end;
};

/** L'étudiant peut-il écrire, exécuter et enregistrer ? Seulement pendant l'examen, et s'il n'est pas bloqué. */
export function canWork(status: ExamStatus, seat: SeatStatus, startedAt: Date | null, durationMin: number, now: number, graceMs = 0): boolean {
  const end = endsAtOf(startedAt, durationMin);
  return status === 'RUNNING' && seat === 'ACTIVE' && end !== null && now <= end + graceMs;
}

/** Les raisons qu'un navigateur peut signaler, en clair pour l'enseignant. */
export const LEAVE_REASONS: Record<string, string> = {
  hidden: 'a changé d’onglet ou réduit la fenêtre',
  blur: 'a quitté la fenêtre de l’examen',
  pagehide: 'a fermé ou rechargé la page',
};
export const leaveReason = (raw: unknown): string => LEAVE_REASONS[String(raw)] ?? 'a quitté la page de l’examen';

export interface Seat {
  status: SeatStatus;
  leaveCount: number;
  lockedAt: Date | null;
  lockReason: string | null;
}

/**
 * Sortie de page signalée. Seul un étudiant en train de composer est bloqué : un étudiant déjà bloqué qui ressort
 * ne compte pas une sortie de plus (sinon chaque clic hors de l'écran de blocage gonflerait le compteur).
 */
export function applyLeave(seat: Seat, reason: string, now: Date): { seat: Seat; changed: boolean } {
  if (seat.status !== 'ACTIVE') return { seat, changed: false };
  return { seat: { status: 'LOCKED', leaveCount: seat.leaveCount + 1, lockedAt: now, lockReason: reason }, changed: true };
}

/** Décision de l'enseignant : débloquer (l'étudiant reprend) ou clore la copie. Une copie rendue ne bouge plus. */
export function applyDecision(seat: Seat, decision: 'unlock' | 'exclude'): { seat: Seat; changed: boolean } {
  if (seat.status === 'SUBMITTED') return { seat, changed: false };
  if (decision === 'unlock') {
    if (seat.status === 'ACTIVE') return { seat, changed: false };
    return { seat: { ...seat, status: 'ACTIVE', lockedAt: null, lockReason: null }, changed: true };
  }
  if (seat.status === 'EXCLUDED') return { seat, changed: false };
  return { seat: { ...seat, status: 'EXCLUDED', lockedAt: null }, changed: true };
}

/** Note sur 20 à partir du nombre de défis réussis (arrondie au demi-point). */
export const gradeOn20 = (correct: number, total: number): number => (total > 0 ? Math.round((correct / total) * 40) / 2 : 0);

/** Ordre d'affichage de la salle côté enseignant : les bloqués d'abord (ils attendent une décision), puis le reste. */
const ORDER: Record<SeatStatus, number> = { LOCKED: 0, ACTIVE: 1, EXCLUDED: 2, SUBMITTED: 3 };
export function sortSeats<T extends { status: SeatStatus; lockedAt: Date | null; name: string }>(seats: T[]): T[] {
  return [...seats].sort(
    (a, b) =>
      ORDER[a.status] - ORDER[b.status] ||
      (a.status === 'LOCKED' ? (a.lockedAt?.getTime() ?? 0) - (b.lockedAt?.getTime() ?? 0) : 0) ||
      a.name.localeCompare(b.name, 'fr'),
  );
}
