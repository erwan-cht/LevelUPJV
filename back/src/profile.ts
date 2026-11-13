// Profil de l'étudiant : statistiques, historique, compétences, succès (badges) et préférences.
import { Router } from 'express';
import { requireAuth } from './auth.js';
import { syncBadges } from './badges.js';
import { prisma } from './db.js';
import { leagueOf, startOfDay, subjectLabel } from './format.js';
import { competenceLevels, findUser, grantPoints, userSummary } from './services.js';

export const profileRouter = Router();

const DAY = 86_400_000;

/** Niveau d'intensité (0 à 4) d'une case de la carte de chaleur, selon les points du jour. */
const heatLevel = (points: number) => (points <= 0 ? 0 : points < 30 ? 1 : points < 60 ? 2 : points < 120 ? 3 : 4);

const two = (n: number) => String(n).padStart(2, '0');

profileRouter.get('/profile', requireAuth('STUDENT'), async (req, res) => {
  const user = await findUser(req.auth!.sub);
  if (!user) {
    res.status(401).json({ error: 'Compte introuvable.' });
    return;
  }

  const today = startOfDay();
  const monday = new Date(today.getTime() - ((new Date().getDay() + 6) % 7) * DAY);
  const gridStart = new Date(monday.getTime() - 11 * 7 * DAY);

  const [summary, badges, events, attempts, published, competences, promotion] = await Promise.all([
    userSummary(user),
    syncBadges(user.id),
    prisma.pointEvent.findMany({ where: { userId: user.id, createdAt: { gte: gridStart }, points: { gt: 0 } } }),
    prisma.attempt.findMany({
      where: { userId: user.id, duelId: null },
      orderBy: { createdAt: 'asc' },
      select: {
        challengeId: true,
        status: true,
        createdAt: true,
        challenge: { select: { title: true, subject: true, basePoints: true, status: true } },
      },
    }),
    prisma.challenge.groupBy({ by: ['subject'], where: { status: 'PUBLISHED' }, _count: true }),
    competenceLevels([user.id]),
    user.group ? prisma.promotion.findUnique({ where: { code: user.group.promo } }) : Promise.resolve(null),
  ]);

  // Carte de chaleur : 12 semaines × 7 jours (lundi → dimanche)
  const perDay = new Map<number, number>();
  for (const e of events) {
    const k = startOfDay(e.createdAt).getTime();
    perDay.set(k, (perDay.get(k) ?? 0) + e.points);
  }
  let activeDays = 0;
  let points12w = 0;
  const heatmap = Array.from({ length: 12 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = gridStart.getTime() + (w * 7 + d) * DAY;
      if (day > today.getTime()) return 0;
      const p = perDay.get(day) ?? 0;
      if (p > 0) activeDays++;
      points12w += p;
      return heatLevel(p);
    }),
  );
  const totalDays = Math.floor((today.getTime() - gridStart.getTime()) / DAY) + 1;

  // Défis réussis : première réussite de chaque défi, avec le temps passé depuis la première tentative
  const firstTry = new Map<number, Date>();
  const firstPass = new Map<number, { at: Date; title: string; subject: string; points: number; published: boolean }>();
  for (const a of attempts) {
    if (!firstTry.has(a.challengeId)) firstTry.set(a.challengeId, a.createdAt);
    if (a.status === 'PASSED' && !firstPass.has(a.challengeId)) {
      firstPass.set(a.challengeId, {
        at: a.createdAt,
        title: a.challenge.title,
        subject: a.challenge.subject,
        points: a.challenge.basePoints,
        published: a.challenge.status === 'PUBLISHED',
      });
    }
  }
  const history = [...firstPass.entries()]
    .sort((a, b) => b[1].at.getTime() - a[1].at.getTime())
    .map(([challengeId, p]) => {
      const minutes = Math.round((p.at.getTime() - firstTry.get(challengeId)!.getTime()) / 60_000);
      return {
        title: p.title,
        subject: subjectLabel[p.subject],
        date: `${two(p.at.getDate())}/${two(p.at.getMonth() + 1)}`,
        duration: minutes < 1 ? '—' : `${minutes} min`,
        points: p.points,
      };
    });

  // Progression par matière
  const counts = new Map(published.map((p) => [p.subject, p._count]));
  const doneBySubject = new Map<string, number>();
  for (const p of firstPass.values()) {
    if (p.published) doneBySubject.set(p.subject, (doneBySubject.get(p.subject) ?? 0) + 1);
  }
  const subjectProgress = Object.keys(subjectLabel).map((s) => ({
    subject: subjectLabel[s],
    done: doneBySubject.get(s) ?? 0,
    total: counts.get(s as never) ?? 0,
  }));

  const earned = badges.filter((b) => b.earned);
  res.json({
    user: summary,
    info: {
      promotion: promotion?.name ?? summary.formation,
      group: user.group ? (user.group.name.split(' · ').pop() ?? user.group.name) : null,
      league: leagueOf(user.points),
      ent: user.email.split('@')[0],
      memberSince: user.createdAt.toISOString(),
    },
    stats: {
      solved: [...firstPass.values()].filter((p) => p.published).length,
      totalChallenges: published.reduce((s, p) => s + p._count, 0),
      badgesEarned: earned.length,
      badgesTotal: badges.length,
      bestStreak: Math.max(user.bestStreak, user.streakDays),
    },
    heatmap: { weeks: heatmap, activeDays, totalDays, points: points12w },
    subjectProgress,
    recent: history.slice(0, 4),
    history: history.slice(0, 60),
    badges: badges.map((b) => ({ name: b.name, earned: b.earned })),
    competences: competences.map((c) => ({ name: c.name, description: c.description, value: c.value })),
    settings: { showInRanking: user.showInRanking, acceptDuels: user.acceptDuels, dailyReminder: user.dailyReminder },
  });
});

/** Préférences de confidentialité et de rappel. */
profileRouter.patch('/me/settings', requireAuth('STUDENT'), async (req, res) => {
  const data: Record<string, boolean> = {};
  for (const key of ['showInRanking', 'acceptDuels', 'dailyReminder']) {
    if (typeof req.body?.[key] === 'boolean') data[key] = req.body[key];
  }
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: 'Aucune préférence valide.' });
    return;
  }
  const u = await prisma.user.update({ where: { id: req.auth!.sub }, data });
  res.json({ showInRanking: u.showInRanking, acceptDuels: u.acceptDuels, dailyReminder: u.dailyReminder });
});

// ───────────── Succès ─────────────

profileRouter.get('/achievements', requireAuth('STUDENT'), async (req, res) => {
  const states = await syncBadges(req.auth!.sub);
  res.json({
    items: states.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      points: b.rewardPoints,
      earned: b.earned,
      claimed: b.claimed,
      progress: b.progress,
      threshold: b.threshold,
    })),
  });
});

/** Récupère la récompense d'un badge gagné (une seule fois). */
profileRouter.post('/achievements/:id/claim', requireAuth('STUDENT'), async (req, res) => {
  const userId = req.auth!.sub;
  const badgeId = Number(req.params.id);
  const badge = (await syncBadges(userId)).find((b) => b.id === badgeId);
  if (!badge || !badge.earned) {
    res.status(409).json({ error: 'Ce succès n’est pas encore débloqué.' });
    return;
  }
  if (badge.claimed) {
    res.status(409).json({ error: 'Récompense déjà réclamée.' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    // updateMany sur « claimed: false » : deux clics simultanés ne paient qu'une fois.
    const done = await tx.userBadge.updateMany({ where: { userId, badgeId, claimed: false }, data: { claimed: true } });
    if (done.count === 1 && badge.rewardPoints > 0) {
      await grantPoints(tx, userId, { points: badge.rewardPoints, reason: `badge:${badge.slug}` });
    }
  });
  res.json({ claimed: true, points: badge.rewardPoints });
});
