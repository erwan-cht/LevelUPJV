import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { requireAuth, signToken } from './auth.js';
import { prisma } from './db.js';
import { difficultyLabel, roleLabel, startOfDay, subjectLabel } from './format.js';
import { describeTables, judge, runQuery } from './sql.js';
import { findUser, listChallenges, ranking, userSummary } from './services.js';

export const api = Router();

const ID = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// ───────────── Connexion ─────────────

api.post('/auth/login', async (req, res) => {
  const identifiant = String(req.body?.identifiant ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!identifiant || !password) {
    res.status(400).json({ error: 'Renseigne ton identifiant et ton mot de passe.' });
    return;
  }

  // On accepte l'e-mail complet ou seulement la partie avant @ (ex. « oscar.lescot »).
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifiant }, { email: { startsWith: `${identifiant}@` } }] },
  });
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) {
    res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
    return;
  }

  res.json({ token: signToken({ sub: user.id, role: user.role }), role: roleLabel[user.role] });
});

// ───────────── Utilisateur et tableau de bord ─────────────

api.get('/me', requireAuth(), async (req, res) => {
  const user = await findUser(req.auth!.sub);
  if (!user) {
    res.status(401).json({ error: 'Compte introuvable.' });
    return;
  }
  res.json(await userSummary(user));
});

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

api.get('/dashboard', requireAuth('STUDENT'), async (req, res) => {
  const user = await findUser(req.auth!.sub);
  if (!user) {
    res.status(401).json({ error: 'Compte introuvable.' });
    return;
  }
  const since = startOfDay(new Date(Date.now() - 6 * 86_400_000));

  const [summary, challenges, promo, groupe, events, badges, owned, solved] = await Promise.all([
    userSummary(user),
    listChallenges(user.id),
    ranking(user, 'promo'),
    ranking(user, 'groupe'),
    prisma.pointEvent.findMany({ where: { userId: user.id, createdAt: { gte: since }, points: { gt: 0 } } }),
    prisma.badge.findMany({ orderBy: { id: 'asc' } }),
    prisma.userBadge.findMany({ where: { userId: user.id } }),
    prisma.attempt.findMany({
      where: { userId: user.id, status: 'PASSED' },
      distinct: ['challengeId'],
      include: { challenge: { select: { subject: true } } },
    }),
  ]);

  // Activité des 7 derniers jours
  const activity = Array.from({ length: 7 }, (_, i) => {
    const day = startOfDay(new Date(Date.now() - (6 - i) * 86_400_000));
    const next = day.getTime() + 86_400_000;
    const points = events
      .filter((e) => e.createdAt.getTime() >= day.getTime() && e.createdAt.getTime() < next)
      .reduce((s, e) => s + e.points, 0);
    return { label: i === 6 ? 'Auj.' : DAYS[day.getDay()], points, isToday: i === 6 };
  });

  // Classement : podium + voisins directs de l'utilisateur
  const around = (list: typeof promo) => {
    const me = list.findIndex((r) => r.isMe);
    const keep = new Set([0, 1, 2, me - 1, me, me + 1].filter((i) => i >= 0 && i < list.length));
    return [...keep].sort((a, b) => a - b).map((i) => list[i]);
  };

  // Badges
  const earned = new Set(owned.map((o) => o.badgeId));
  const badgeList = badges.map((b) => ({
    name: b.name,
    variant: earned.has(b.id) ? (b.variant === 'orange' ? 'orange' : 'navy') : 'locked',
  }));
  const subjectsDone = new Set(solved.map((a) => a.challenge.subject)).size;
  const nextBadge = { name: 'Full-stack', progress: subjectsDone, total: 3, unit: 'matières' };

  // Objectifs et série de la semaine
  const todayStart = startOfDay().getTime();
  const passedToday = await prisma.attempt.count({
    where: { userId: user.id, status: 'PASSED', createdAt: { gte: new Date(todayStart) } },
  });
  const dailyObjectives = [
    { label: 'Réussir 1 défi', xp: 40, done: passedToday > 0 },
    { label: 'Gagner 50 points', xp: 30, done: summary.pointsToday >= 50 },
    { label: 'Faire 1 duel', xp: 50, done: false },
  ];
  const monday = new Date(todayStart - ((new Date().getDay() + 6) % 7) * 86_400_000);
  const weekEvents = await prisma.pointEvent.findMany({ where: { userId: user.id, createdAt: { gte: monday } } });
  const streak = WEEK.map((label, i) => {
    const d = monday.getTime() + i * 86_400_000;
    const active = weekEvents.some((e) => e.createdAt.getTime() >= d && e.createdAt.getTime() < d + 86_400_000);
    const isToday = d === todayStart;
    return { label, state: isToday ? 'today' : active && d < todayStart ? 'done' : 'todo' };
  });

  res.json({
    user: summary,
    challenges,
    promoRanking: around(promo),
    groupRanking: around(groupe),
    activity,
    badges: badgeList,
    nextBadge,
    dailyObjectives,
    streak,
    streakDays: user.streakDays,
  });
});

// ───────────── Classement ─────────────

api.get('/ranking', requireAuth('STUDENT'), async (req, res) => {
  const user = await findUser(req.auth!.sub);
  if (!user) {
    res.status(401).json({ error: 'Compte introuvable.' });
    return;
  }
  const scope = req.query.scope === 'groupe' ? 'groupe' : 'promo';
  const entries = await ranking(user, scope);

  // Points gagnés par semaine (6 dernières semaines)
  const weeks = 6;
  const start = startOfDay(new Date(Date.now() - weeks * 7 * 86_400_000));
  const events = await prisma.pointEvent.findMany({
    where: { userId: user.id, createdAt: { gte: start }, points: { gt: 0 } },
  });
  const weekly = Array.from({ length: weeks }, (_, i) => {
    const from = start.getTime() + i * 7 * 86_400_000;
    const points = events
      .filter((e) => e.createdAt.getTime() >= from && e.createdAt.getTime() < from + 7 * 86_400_000)
      .reduce((s, e) => s + e.points, 0);
    return { label: `S${i + 1}`, points };
  });

  res.json({ entries, weekly });
});

// ───────────── Défis ─────────────

api.get('/challenges', requireAuth('STUDENT'), async (req, res) => {
  res.json(await listChallenges(req.auth!.sub));
});

const HINTS = [
  { level: 1, cost: 0, text: 'Relis l’énoncé : de quelles tables as-tu besoin, et quelles colonnes doivent apparaître dans le résultat ?' },
  { level: 2, cost: 10, text: 'Pense à l’ordre d’exécution : FROM / JOIN, puis WHERE, puis GROUP BY, puis HAVING, puis SELECT et ORDER BY.' },
  { level: 3, cost: 20, text: 'Compare le nombre de lignes obtenues et attendues après chaque modification : l’écart indique si le souci vient d’un filtre ou d’une jointure.' },
];

api.get('/challenges/:id', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const userId = req.auth!.sub;
  const c = id
    ? await prisma.challenge.findFirst({
        where: { id, published: true },
        include: { competences: { include: { competence: true } } },
      })
    : null;
  if (!c) {
    res.status(404).json({ error: 'Défi introuvable.' });
    return;
  }

  const [attempts, hints, fav] = await Promise.all([
    prisma.attempt.count({ where: { userId, challengeId: c.id } }),
    prisma.hint.findMany({ where: { userId, challengeId: c.id } }),
    prisma.favorite.findUnique({ where: { userId_challengeId: { userId, challengeId: c.id } } }),
  ]);
  const unlocked = new Set(hints.map((h) => h.level));

  res.json({
    id: c.id,
    title: c.title,
    statement: c.statement,
    type: c.type,
    subject: subjectLabel[c.subject],
    difficulty: difficultyLabel[c.difficulty],
    minutes: c.minutes,
    points: c.basePoints,
    competence: c.competences[0]?.competence.name ?? null,
    starterCode: c.starterCode ?? '',
    tables: c.setupSql ? describeTables(c.setupSql) : [],
    gradable: c.type === 'SQL' && Boolean(c.setupSql && c.solutionSql),
    attempts,
    maxAttempts: 5,
    favorite: Boolean(fav),
    // Le texte d'un indice n'est envoyé que s'il a déjà été débloqué.
    hints: HINTS.map((h) => ({ level: h.level, cost: h.cost, text: unlocked.has(h.level) ? h.text : null })),
  });
});

/** Exécute la requête sans la corriger (bouton « Exécuter »). */
api.post('/challenges/:id/run', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const c = id ? await prisma.challenge.findFirst({ where: { id, published: true } }) : null;
  if (!c?.setupSql) {
    res.status(400).json({ error: 'Ce défi ne s’exécute pas dans le navigateur.' });
    return;
  }
  const out = runQuery(c.setupSql, String(req.body?.query ?? ''));
  res.json(out);
});

/** Valide la réponse : correction automatique, tentative enregistrée, points au premier succès. */
api.post('/challenges/:id/attempt', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const userId = req.auth!.sub;
  const answer = String(req.body?.answer ?? '');
  const c = id ? await prisma.challenge.findFirst({ where: { id, published: true } }) : null;
  if (!c) {
    res.status(404).json({ error: 'Défi introuvable.' });
    return;
  }
  if (c.type !== 'SQL' || !c.setupSql || !c.solutionSql) {
    res.status(501).json({ error: 'La correction automatique n’est pas encore disponible pour ce type de défi.' });
    return;
  }

  const verdict = judge(c.setupSql, c.solutionSql, answer);
  if ('error' in verdict) {
    await prisma.attempt.create({
      data: { userId, challengeId: c.id, answer, status: 'ERROR', feedback: { error: verdict.error } },
    });
    res.json({ status: 'ERROR', message: verdict.error, pointsAwarded: 0 });
    return;
  }

  const already = await prisma.attempt.count({ where: { userId, challengeId: c.id, status: 'PASSED' } });
  const award = verdict.passed && already === 0 ? c.basePoints : 0;

  await prisma.$transaction(async (tx) => {
    await tx.attempt.create({
      data: {
        userId,
        challengeId: c.id,
        answer,
        status: verdict.passed ? 'PASSED' : 'FAILED',
        testsPassed: verdict.testsPassed,
        testsTotal: verdict.testsTotal,
        feedback: JSON.parse(JSON.stringify({ expected: verdict.expected, obtained: verdict.obtained })),
      },
    });
    if (award > 0) {
      const u = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const today = startOfDay();
      const yesterday = new Date(today.getTime() - 86_400_000);
      const last = u.lastActiveDay ? startOfDay(u.lastActiveDay).getTime() : 0;
      const streak = last === today.getTime() ? u.streakDays : last === yesterday.getTime() ? u.streakDays + 1 : 1;
      await tx.pointEvent.create({ data: { userId, points: award, xp: award, reason: `challenge:${c.id}` } });
      await tx.user.update({
        where: { id: userId },
        data: { points: { increment: award }, xp: { increment: award }, streakDays: streak, lastActiveDay: today },
      });
    }
  });

  res.json({
    status: verdict.passed ? 'PASSED' : 'FAILED',
    message: verdict.message,
    expected: verdict.expected,
    obtained: verdict.obtained,
    testsPassed: verdict.testsPassed,
    testsTotal: verdict.testsTotal,
    pointsAwarded: award,
  });
});

/** Débloque un indice (le coût en points n'est prélevé qu'une fois par indice). */
api.post('/challenges/:id/hints', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const userId = req.auth!.sub;
  const level = Number(req.body?.level);
  const hint = HINTS.find((h) => h.level === level);
  const c = id ? await prisma.challenge.findFirst({ where: { id, published: true } }) : null;
  if (!c || !hint) {
    res.status(404).json({ error: 'Indice introuvable.' });
    return;
  }

  const existing = await prisma.hint.findFirst({ where: { userId, challengeId: c.id, level } });
  if (!existing) {
    await prisma.$transaction([
      prisma.hint.create({
        data: { userId, challengeId: c.id, level, prompt: `indice ${level}`, response: hint.text, cost: hint.cost },
      }),
      ...(hint.cost > 0
        ? [
            prisma.pointEvent.create({ data: { userId, points: -hint.cost, reason: `hint:${c.id}:${level}` } }),
            prisma.user.update({ where: { id: userId }, data: { points: { decrement: hint.cost } } }),
          ]
        : []),
    ]);
  }
  res.json({ level, cost: hint.cost, text: hint.text });
});

api.post('/challenges/:id/favorite', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const userId = req.auth!.sub;
  if (!id) {
    res.status(404).json({ error: 'Défi introuvable.' });
    return;
  }
  const key = { userId_challengeId: { userId, challengeId: id } };
  const existing = await prisma.favorite.findUnique({ where: key });
  if (existing) await prisma.favorite.delete({ where: key });
  else await prisma.favorite.create({ data: { userId, challengeId: id } });
  res.json({ favorite: !existing });
});
