// Badges : chaque badge a une règle (mesure + seuil) en base, évaluée ici à partir de l'activité réelle.
import { prisma } from './db.js';
import { loadBoard, findUser } from './services.js';

/** Mesures de l'activité d'un étudiant (hors duels, sauf DUELS_WON). */
export async function metricsFor(userId: number): Promise<Record<string, number>> {
  const [attempts, user, duelsWon] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId, duelId: null },
      orderBy: { createdAt: 'asc' },
      select: { challengeId: true, status: true, createdAt: true, challenge: { select: { subject: true } } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { bestStreak: true, streakDays: true } }),
    prisma.duel.count({ where: { winnerId: userId, status: 'FINISHED' } }),
  ]);

  const firstAttempt = new Map<number, string>();
  const solved = new Map<number, string>(); // challengeId -> matière
  let night = 0;
  for (const a of attempts) {
    if (!firstAttempt.has(a.challengeId)) firstAttempt.set(a.challengeId, a.status);
    if (a.status === 'PASSED') {
      solved.set(a.challengeId, a.challenge.subject);
      if (a.createdAt.getHours() < 5) night++;
    }
  }
  const perSubject = (subject: string) => [...solved.values()].filter((s) => s === subject).length;

  return {
    PASSED_TOTAL: solved.size,
    PASSED_DATABASES: perSubject('DATABASES'),
    PASSED_ALGORITHMICS: perSubject('ALGORITHMICS'),
    PASSED_WEB_DEV: perSubject('WEB_DEV'),
    PASSED_NETWORKS_SYSTEMS: perSubject('NETWORKS_SYSTEMS'),
    SUBJECTS_DONE: new Set(solved.values()).size,
    STREAK: Math.max(user?.bestStreak ?? 0, user?.streakDays ?? 0),
    DUELS_WON: duelsWon,
    FIRST_TRY: [...solved.keys()].filter((id) => firstAttempt.get(id) === 'PASSED').length,
    NIGHT_PASSES: night,
  };
}

/** Rang dans la promo (0 si l'étudiant n'a encore aucun point). */
async function promoRank(userId: number) {
  const u = await findUser(userId);
  if (!u || u.points <= 0) return 0;
  return (await loadBoard(u, 'promo')).find((b) => b.row.id === userId)?.rank ?? 0;
}

export interface BadgeState {
  id: number;
  slug: string;
  name: string;
  description: string;
  rewardPoints: number;
  variant: string;
  metric: string;
  threshold: number;
  earned: boolean;
  claimed: boolean;
  earnedAt: Date | null;
  /** Valeur actuelle de la mesure, plafonnée au seuil (pour la barre de progression). */
  progress: number;
}

/** Attribue les badges dont la règle est remplie, puis renvoie l'état de tous les badges. */
export async function syncBadges(userId: number): Promise<BadgeState[]> {
  const [badges, owned, metrics, rank] = await Promise.all([
    prisma.badge.findMany({ orderBy: { id: 'asc' } }),
    prisma.userBadge.findMany({ where: { userId } }),
    metricsFor(userId),
    promoRank(userId),
  ]);
  const have = new Map(owned.map((o) => [o.badgeId, o]));

  const reached = (b: { metric: string; threshold: number }) =>
    b.metric === 'TOP_RANK' ? rank > 0 && rank <= b.threshold : (metrics[b.metric] ?? 0) >= b.threshold;

  const fresh = badges.filter((b) => !have.has(b.id) && reached(b));
  if (fresh.length > 0) {
    await prisma.userBadge.createMany({ data: fresh.map((b) => ({ userId, badgeId: b.id })), skipDuplicates: true });
    for (const b of fresh) have.set(b.id, { userId, badgeId: b.id, earnedAt: new Date(), claimed: false });
  }

  return badges.map((b) => {
    const mine = have.get(b.id);
    const value = b.metric === 'TOP_RANK' ? (rank > 0 && rank <= b.threshold ? 1 : 0) : (metrics[b.metric] ?? 0);
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      rewardPoints: b.rewardPoints,
      variant: b.variant,
      metric: b.metric,
      threshold: b.metric === 'TOP_RANK' ? 1 : b.threshold,
      earned: Boolean(mine),
      claimed: mine?.claimed ?? false,
      earnedAt: mine?.earnedAt ?? null,
      progress: Math.min(value, b.metric === 'TOP_RANK' ? 1 : b.threshold),
    };
  });
}
