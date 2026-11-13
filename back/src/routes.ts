import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { requireAuth, signToken } from './auth.js';
import { syncBadges } from './badges.js';
import { prisma } from './db.js';
import {
  LEAGUE_LIST,
  difficultyLabel,
  leagueOf,
  metricUnit,
  roleLabel,
  startOfDay,
  subjectLabel,
} from './format.js';
import { adminRouter } from './admin.js';
import { duelsRouter } from './duels.js';
import { profileRouter } from './profile.js';
import { describeTables, judge, runQuery } from './sql.js';
import { teacherRouter } from './teacher.js';
import {
  findUser,
  grantPoints,
  listChallenges,
  onlinePlayers,
  ranking,
  userSummary,
} from './services.js';

export const api = Router();

const ID = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Options choisies par l'enseignant à la création du défi (Challenge.settings). */
interface ChallengeSettings {
  maxAttempts?: number | null;
  orderMatters?: boolean;
}
const settingsOf = (c: { settings: unknown }) => (c.settings ?? {}) as ChallengeSettings;

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
  // Le statut n'est révélé qu'après un mot de passe correct.
  if (user.status === 'SUSPENDED') {
    res.status(403).json({ error: 'Ton compte est suspendu. Contacte l’administrateur de la plateforme.' });
    return;
  }
  if (user.status === 'PENDING') {
    res.status(403).json({ error: 'Ton compte est en attente de validation par un administrateur.' });
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), lastSeenAt: new Date() } });
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
  const todayStart = startOfDay();
  const monday = new Date(todayStart.getTime() - ((new Date().getDay() + 6) % 7) * 86_400_000);

  const [summary, challenges, promo, groupe, events, badgeStates, online, passedToday, duelsToday, weekEvents] =
    await Promise.all([
      userSummary(user),
      listChallenges(user.id),
      ranking(user, 'promo'),
      ranking(user, 'groupe'),
      prisma.pointEvent.findMany({ where: { userId: user.id, createdAt: { gte: since }, points: { gt: 0 } } }),
      syncBadges(user.id),
      onlinePlayers(user),
      prisma.attempt.count({
        where: { userId: user.id, status: 'PASSED', duelId: null, createdAt: { gte: todayStart } },
      }),
      prisma.duel.count({
        where: {
          status: 'FINISHED',
          finishedAt: { gte: todayStart },
          OR: [{ challengerId: user.id }, { opponentId: user.id }],
        },
      }),
      prisma.pointEvent.findMany({ where: { userId: user.id, createdAt: { gte: monday } } }),
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

  // Badges : les 6 plus récents gagnés, complétés par des badges à débloquer
  const earned = badgeStates
    .filter((b) => b.earned)
    .sort((a, b) => (b.earnedAt?.getTime() ?? 0) - (a.earnedAt?.getTime() ?? 0));
  const locked = badgeStates.filter((b) => !b.earned);
  const badgeList = [...earned, ...locked].slice(0, 6).map((b) => ({
    name: b.name,
    variant: b.earned ? (b.variant === 'orange' ? 'orange' : 'navy') : 'locked',
  }));

  // Prochain badge : le plus avancé parmi ceux qui restent à gagner
  const closest = locked
    .filter((b) => b.metric !== 'TOP_RANK')
    .sort((a, b) => b.progress / b.threshold - a.progress / a.threshold)[0];
  const nextBadge = closest
    ? { name: closest.name, progress: closest.progress, total: closest.threshold, unit: metricUnit[closest.metric] ?? '' }
    : null;

  // Objectifs et série de la semaine
  const dailyObjectives = [
    { label: 'Réussir 1 défi', xp: 40, done: passedToday > 0 },
    { label: 'Gagner 50 points', xp: 30, done: summary.pointsToday >= 50 },
    { label: 'Faire 1 duel', xp: 50, done: duelsToday > 0 },
  ];
  const streak = WEEK.map((label, i) => {
    const d = monday.getTime() + i * 86_400_000;
    const active = weekEvents.some((e) => e.createdAt.getTime() >= d && e.createdAt.getTime() < d + 86_400_000);
    const isToday = d === todayStart.getTime();
    return { label, state: isToday ? 'today' : active && d < todayStart.getTime() ? 'done' : 'todo' };
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
    online,
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

  res.json({
    entries,
    weekly,
    leagues: LEAGUE_LIST,
    league: leagueOf(user.points),
    scopeLabel: scope === 'groupe' ? (user.group?.name ?? 'Ton groupe') : (user.group?.promo ?? 'Ta promo'),
  });
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
        where: { id, status: 'PUBLISHED' },
        include: { competences: { include: { competence: true } } },
      })
    : null;
  if (!c) {
    res.status(404).json({ error: 'Défi introuvable.' });
    return;
  }

  const [attempts, hints, fav] = await Promise.all([
    prisma.attempt.count({ where: { userId, challengeId: c.id, duelId: null } }),
    prisma.hint.findMany({ where: { userId, challengeId: c.id } }),
    prisma.favorite.findUnique({ where: { userId_challengeId: { userId, challengeId: c.id } } }),
  ]);
  const unlocked = new Set(hints.map((h) => h.level));
  const settings = settingsOf(c);

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
    // null : tentatives illimitées. Sans réglage de l'enseignant, la limite par défaut est de 5.
    maxAttempts: settings.maxAttempts === undefined ? 5 : settings.maxAttempts,
    favorite: Boolean(fav),
    // Le texte d'un indice n'est envoyé que s'il a déjà été débloqué.
    hints: HINTS.map((h) => ({ level: h.level, cost: h.cost, text: unlocked.has(h.level) ? h.text : null })),
  });
});

/** Exécute la requête sans la corriger (bouton « Exécuter »). */
api.post('/challenges/:id/run', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const c = id ? await prisma.challenge.findFirst({ where: { id, status: 'PUBLISHED' } }) : null;
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
  const c = id ? await prisma.challenge.findFirst({ where: { id, status: 'PUBLISHED' } }) : null;
  if (!c) {
    res.status(404).json({ error: 'Défi introuvable.' });
    return;
  }
  if (c.type !== 'SQL' || !c.setupSql || !c.solutionSql) {
    res.status(501).json({ error: 'La correction automatique n’est pas encore disponible pour ce type de défi.' });
    return;
  }

  // Limite de tentatives, uniquement si l'enseignant en a fixé une.
  const settings = settingsOf(c);
  const [used, already] = await Promise.all([
    prisma.attempt.count({ where: { userId, challengeId: c.id, duelId: null } }),
    prisma.attempt.count({ where: { userId, challengeId: c.id, status: 'PASSED', duelId: null } }),
  ]);
  if (typeof settings.maxAttempts === 'number' && used >= settings.maxAttempts && already === 0) {
    res.status(429).json({ error: `Tu as utilisé les ${settings.maxAttempts} tentatives autorisées pour ce défi.` });
    return;
  }

  const verdict = judge(c.setupSql, c.solutionSql, answer, settings.orderMatters);
  if ('error' in verdict) {
    await prisma.attempt.create({
      data: { userId, challengeId: c.id, answer, status: 'ERROR', feedback: { error: verdict.error } },
    });
    res.json({ status: 'ERROR', message: verdict.error, pointsAwarded: 0 });
    return;
  }

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
    if (award > 0) await grantPoints(tx, userId, { points: award, reason: `challenge:${c.id}`, activity: true });
  });
  if (verdict.passed) await syncBadges(userId);

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
  const c = id ? await prisma.challenge.findFirst({ where: { id, status: 'PUBLISHED' } }) : null;
  if (!c || !hint) {
    res.status(404).json({ error: 'Indice introuvable.' });
    return;
  }

  const existing = await prisma.hint.findFirst({ where: { userId, challengeId: c.id, level } });
  if (!existing) {
    await prisma.$transaction(async (tx) => {
      await tx.hint.create({
        data: { userId, challengeId: c.id, level, prompt: `indice ${level}`, response: hint.text, cost: hint.cost },
      });
      if (hint.cost > 0) {
        await grantPoints(tx, userId, { points: -hint.cost, xp: 0, reason: `hint:${c.id}:${level}` });
      }
    });
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

// ───────────── Autres espaces ─────────────

api.use(profileRouter);
api.use(duelsRouter);
api.use('/teacher', teacherRouter);
api.use('/admin', adminRouter);
