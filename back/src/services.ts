import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from './db.js';
import {
  ONLINE_MS,
  colorFor,
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
export type Tx = Prisma.TransactionClient;

const DAY = 86_400_000;

export const findUser = (id: number) => prisma.user.findUnique({ where: { id }, include: { group: true } });

// ───────────── Classement ─────────────

export type Scope = 'promo' | 'groupe';

/**
 * Classement par points d'une promo ou d'un groupe, avec l'évolution du rang sur 7 jours
 * (rang d'il y a une semaine = classement sur « points − points gagnés depuis »).
 * Les étudiants qui ont masqué leur place n'apparaissent que dans leur propre classement.
 */
export async function loadBoard(u: UserRow, scope: Scope) {
  const promo = u.group?.promo;
  const scoped = scope === 'groupe' && u.groupId ? { groupId: u.groupId } : promo ? { group: { promo } } : {};

  const rows = await prisma.user.findMany({
    where: { role: 'STUDENT', status: 'ACTIVE', ...scoped, OR: [{ showInRanking: true }, { id: u.id }] },
    include: { group: true },
  });
  const gains = await prisma.pointEvent.groupBy({
    by: ['userId'],
    where: { userId: { in: rows.map((r) => r.id) }, createdAt: { gte: new Date(Date.now() - 7 * DAY) } },
    _sum: { points: true },
  });
  const gained = new Map(gains.map((g) => [g.userId, g._sum.points ?? 0]));

  const byPoints = (value: (r: (typeof rows)[number]) => number) =>
    [...rows].sort((a, b) => value(b) - value(a) || a.id - b.id);
  const before = new Map(byPoints((r) => r.points - (gained.get(r.id) ?? 0)).map((r, i) => [r.id, i + 1]));

  return byPoints((r) => r.points).map((row, i) => ({ row, rank: i + 1, delta: (before.get(row.id) ?? i + 1) - (i + 1) }));
}

export async function ranking(u: UserRow, scope: Scope) {
  const [board, passed] = await Promise.all([
    loadBoard(u, scope),
    prisma.attempt.groupBy({ by: ['userId', 'challengeId'], where: { status: 'PASSED', duelId: null } }),
  ]);
  const solved = new Map<number, number>();
  for (const p of passed) solved.set(p.userId, (solved.get(p.userId) ?? 0) + 1);

  return board.map(({ row: r, rank, delta }) => ({
    rank,
    name: `${r.firstName} ${r.lastName}`,
    initials: initials(r.firstName, r.lastName),
    group: r.group?.name ?? '',
    level: levelOf(r.xp),
    challenges: solved.get(r.id) ?? 0,
    points: r.points,
    delta,
    isMe: r.id === u.id,
  }));
}

// ───────────── Résumé de l'utilisateur ─────────────

export async function userSummary(u: UserRow) {
  const isStudent = u.role === 'STUDENT';
  const promo = u.group?.promo;
  const [board, today, promotion] = await Promise.all([
    isStudent ? loadBoard(u, 'promo') : Promise.resolve([]),
    prisma.pointEvent.aggregate({
      where: { userId: u.id, createdAt: { gte: startOfDay() }, points: { gt: 0 } },
      _sum: { points: true },
    }),
    promo ? prisma.promotion.findUnique({ where: { code: promo } }) : Promise.resolve(null),
  ]);
  const me = board.find((b) => b.row.id === u.id);

  return {
    id: u.id,
    role: u.role,
    firstName: u.firstName,
    lastName: u.lastName,
    initials: initials(u.firstName, u.lastName),
    shortName: `${u.firstName[0]}. ${u.lastName}`,
    email: u.email,
    formation: promotion?.name ?? (promo ? `${promo} Informatique` : 'IUT d’Amiens'),
    group: u.group?.name ?? null,
    league: `Ligue ${leagueOf(u.points)}`,
    level: levelOf(u.xp),
    xp: u.xp,
    xpNextLevel: nextLevelXp(u.xp),
    points: u.points,
    pointsToday: today._sum.points ?? 0,
    promoRank: me?.rank ?? 0,
    rankDelta: me?.delta ?? 0,
    streakDays: u.streakDays,
    memberSince: u.createdAt.toISOString(),
  };
}

// ───────────── Défis ─────────────

/** Défis publiés, avec l'état de l'étudiant (nouveau / en cours / terminé) et les devoirs de ses enseignants. */
export async function listChallenges(userId: number) {
  const user = await findUser(userId);
  const [challenges, attempts, favorites, assigned] = await Promise.all([
    prisma.challenge.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { id: 'asc' },
      include: { _count: { select: { tests: true } }, competences: { include: { competence: true } } },
    }),
    prisma.attempt.findMany({ where: { userId, duelId: null }, orderBy: { createdAt: 'desc' } }),
    prisma.favorite.findMany({ where: { userId } }),
    prisma.assignment.findMany({
      where: {
        OR: [
          ...(user?.groupId ? [{ groupId: user.groupId }] : []),
          ...(user?.group?.promo ? [{ promoCode: user.group.promo, groupId: null }] : []),
        ],
      },
      select: { challengeId: true },
    }),
  ]);
  const favs = new Set(favorites.map((f) => f.challengeId));
  const recommended = new Set(assigned.map((a) => a.challengeId));

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
      recommended: recommended.has(c.id) && !passed,
      competence: c.competences[0]?.competence.name ?? null,
      type: c.type,
    };
  });
}

// ───────────── Points et série ─────────────

/**
 * Crédite des points et de l'XP (ligne dans PointEvent + compteurs de l'utilisateur).
 * Avec `activity`, la journée compte aussi dans la série (streak).
 */
export async function grantPoints(
  tx: Tx,
  userId: number,
  gain: { points: number; xp?: number; reason: string; activity?: boolean },
) {
  const xp = gain.xp ?? Math.max(gain.points, 0);
  await tx.pointEvent.create({ data: { userId, points: gain.points, xp, reason: gain.reason } });

  const data: Prisma.UserUpdateInput = { points: { increment: gain.points }, xp: { increment: xp } };
  if (gain.activity) {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const today = startOfDay();
    const yesterday = new Date(today.getTime() - DAY);
    const last = u.lastActiveDay ? startOfDay(u.lastActiveDay).getTime() : 0;
    const streak = last === today.getTime() ? u.streakDays : last === yesterday.getTime() ? u.streakDays + 1 : 1;
    data.streakDays = streak;
    data.bestStreak = Math.max(u.bestStreak, streak);
    data.lastActiveDay = today;
  }
  await tx.user.update({ where: { id: userId }, data });
}

// ───────────── Présence ─────────────

/** Camarades de la même promo vus dans les 5 dernières minutes. */
export async function onlinePlayers(u: UserRow) {
  const where: Prisma.UserWhereInput = {
    role: 'STUDENT',
    status: 'ACTIVE',
    id: { not: u.id },
    lastSeenAt: { gte: new Date(Date.now() - ONLINE_MS) },
    ...(u.group?.promo ? { group: { promo: u.group.promo } } : {}),
  };
  const [count, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { lastSeenAt: 'desc' }, take: 5 }),
  ]);
  return {
    count,
    players: rows.map((r) => ({ initials: initials(r.firstName, r.lastName), color: colorFor(r.id) })),
  };
}

// ───────────── Compétences ─────────────

/**
 * Part (en %) des défis publiés de chaque compétence que l'étudiant a réussis, puis moyenne sur `studentIds`.
 * Un défi compte quand l'étudiant l'a réussi hors duel.
 */
export async function competenceLevels(studentIds: number[]) {
  const [competences, passed] = await Promise.all([
    prisma.competence.findMany({
      orderBy: { id: 'asc' },
      include: { challenges: { where: { challenge: { status: 'PUBLISHED' } }, select: { challengeId: true } } },
    }),
    prisma.attempt.findMany({
      where: { userId: { in: studentIds }, status: 'PASSED', duelId: null },
      distinct: ['userId', 'challengeId'],
      select: { userId: true, challengeId: true },
    }),
  ]);
  const solved = new Map<number, Set<number>>();
  for (const p of passed) {
    if (!solved.has(p.userId)) solved.set(p.userId, new Set());
    solved.get(p.userId)!.add(p.challengeId);
  }

  return competences.map((c) => {
    const ids = c.challenges.map((x) => x.challengeId);
    const perStudent = studentIds.map((s) =>
      ids.length === 0 ? 0 : (ids.filter((id) => solved.get(s)?.has(id)).length / ids.length) * 100,
    );
    const value = perStudent.length === 0 ? 0 : Math.round(perStudent.reduce((a, b) => a + b, 0) / perStudent.length);
    return { id: c.id, name: c.name, description: c.description, skills: c.skills, value, challenges: ids.length };
  });
}
