import { prisma } from './db.js';
import {
  difficultyLabel,
  initials,
  leagueOf,
  levelOf,
  nextLevelXp,
  shortDescription,
  startOfDay,
  subjectLabel,
} from './format.js';

type UserRow = NonNullable<Awaited<ReturnType<typeof findUser>>>;

export const findUser = (id: number) => prisma.user.findUnique({ where: { id }, include: { group: true } });

export async function userSummary(u: UserRow) {
  const promo = u.group?.promo;
  const [ahead, today] = await Promise.all([
    prisma.user.count({
      where: { role: 'STUDENT', points: { gt: u.points }, ...(promo ? { group: { promo } } : {}) },
    }),
    prisma.pointEvent.aggregate({
      where: { userId: u.id, createdAt: { gte: startOfDay() }, points: { gt: 0 } },
      _sum: { points: true },
    }),
  ]);

  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    initials: initials(u.firstName, u.lastName),
    email: u.email,
    formation: promo ? `${promo} Informatique` : 'IUT d’Amiens',
    group: u.group?.name ?? null,
    league: `Ligue ${leagueOf(u.points)}`,
    level: levelOf(u.xp),
    xp: u.xp,
    xpNextLevel: nextLevelXp(u.xp),
    points: u.points,
    pointsToday: today._sum.points ?? 0,
    promoRank: ahead + 1,
    rankDelta: 0,
    streakDays: u.streakDays,
  };
}

/** Catalogue des défis publiés, avec l'état de l'étudiant (nouveau / en cours / terminé). */
export async function listChallenges(userId: number) {
  const [challenges, attempts, favorites] = await Promise.all([
    prisma.challenge.findMany({
      where: { published: true },
      orderBy: { id: 'asc' },
      include: { _count: { select: { tests: true } } },
    }),
    prisma.attempt.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.favorite.findMany({ where: { userId } }),
  ]);
  const favs = new Set(favorites.map((f) => f.challengeId));

  return challenges.map((c) => {
    const mine = attempts.filter((a) => a.challengeId === c.id);
    const passed = mine.some((a) => a.status === 'PASSED');
    const last = mine[0];
    const testsTotal = last?.testsTotal || Math.max(c._count.tests, 1);
    const testsPassed = passed ? testsTotal : (last?.testsPassed ?? 0);
    const status = passed ? 'termine' : mine.length > 0 ? 'en-cours' : 'nouveau';
    return {
      id: c.id,
      title: c.title,
      subject: subjectLabel[c.subject],
      difficulty: difficultyLabel[c.difficulty],
      minutes: c.minutes,
      points: c.basePoints,
      description: shortDescription(c.statement),
      tests: testsTotal,
      status,
      testsPassed,
      progress: status === 'en-cours' ? Math.round((testsPassed / testsTotal) * 100) : undefined,
      favorite: favs.has(c.id),
      type: c.type,
    };
  });
}

/** Classement par points : promo ou groupe de l'utilisateur. */
export async function ranking(u: UserRow, scope: 'promo' | 'groupe') {
  const where =
    scope === 'groupe' && u.groupId
      ? { role: 'STUDENT' as const, groupId: u.groupId }
      : { role: 'STUDENT' as const, ...(u.group?.promo ? { group: { promo: u.group.promo } } : {}) };

  const [rows, passed] = await Promise.all([
    prisma.user.findMany({ where, orderBy: [{ points: 'desc' }, { id: 'asc' }], include: { group: true } }),
    prisma.attempt.groupBy({ by: ['userId', 'challengeId'], where: { status: 'PASSED' } }),
  ]);
  const solved = new Map<number, number>();
  for (const p of passed) solved.set(p.userId, (solved.get(p.userId) ?? 0) + 1);

  return rows.map((r, i) => ({
    rank: i + 1,
    name: `${r.firstName} ${r.lastName}`,
    initials: initials(r.firstName, r.lastName),
    group: r.group?.name ?? '',
    level: levelOf(r.xp),
    challenges: solved.get(r.id) ?? 0,
    points: r.points,
    delta: 0,
    isMe: r.id === u.id,
  }));
}
