// Duels : un étudiant en défie un autre sur un exercice SQL corrigé automatiquement.
// Le premier à obtenir le résultat attendu gagne ; à la fin du chrono, celui qui a le plus avancé l'emporte.
// L'état est relu par le navigateur toutes les deux secondes (pas de WebSocket pour l'instant).
import { Router } from 'express';
import { requireAuth } from './auth.js';
import { syncBadges } from './badges.js';
import { prisma } from './db.js';
import {
  difficultyFromLabel,
  difficultyLabel,
  fullName,
  initials,
  isOnline,
  leagueOf,
  levelOf,
  shortName,
  subjectFromLabel,
  subjectLabel,
} from './format.js';
import { describeTables, judge, runQuery } from './sql.js';
import { findUser, grantPoints } from './services.js';

export const duelsRouter = Router();

const STAKE = 60;
const DURATION_SEC = 600;
const MIN = 60_000;

const ID = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const loadDuel = (id: number) =>
  prisma.duel.findUnique({
    where: { id },
    include: {
      challenge: true,
      challenger: { include: { group: true } },
      opponent: { include: { group: true } },
    },
  });
type DuelRow = NonNullable<Awaited<ReturnType<typeof loadDuel>>>;

const gradable = { status: 'PUBLISHED', type: 'SQL', setupSql: { not: null }, solutionSql: { not: null } } as const;

/** Nombre de lignes attendues : sert de « nombre de tests » à atteindre. */
const rowsTotal = (c: { setupSql: string | null; solutionSql: string | null }) =>
  c.setupSql && c.solutionSql ? Math.max(runQuery(c.setupSql, c.solutionSql).rows.length, 1) : 1;

const orderMattersOf = (c: { settings: unknown }) =>
  ((c.settings ?? {}) as { orderMatters?: boolean }).orderMatters;

/** Meilleure progression d'un joueur dans le duel (tentative qui a validé le plus de lignes). */
async function progressOf(duelId: number, userId: number, total: number) {
  const best = await prisma.attempt.findFirst({
    where: { duelId, userId },
    orderBy: [{ testsPassed: 'desc' }, { createdAt: 'asc' }],
    select: { testsPassed: true, testsTotal: true },
  });
  const t = best?.testsTotal || total;
  return { passed: Math.min(best?.testsPassed ?? 0, t), total: t };
}

/**
 * Termine un duel actif (une seule fois, même si deux requêtes arrivent ensemble) et paie le vainqueur
 * si le duel est classé. Renvoie false si le duel était déjà terminé.
 */
async function finish(duel: DuelRow, winnerId: number | null, text: string) {
  const done = await prisma.$transaction(async (tx) => {
    const upd = await tx.duel.updateMany({
      where: { id: duel.id, status: 'ACTIVE' },
      data: { status: 'FINISHED', finishedAt: new Date(), winnerId },
    });
    if (upd.count !== 1) return false;
    await tx.duelEvent.create({ data: { duelId: duel.id, userId: winnerId, text } });
    if (winnerId && duel.ranked && duel.stakePoints > 0) {
      await grantPoints(tx, winnerId, { points: duel.stakePoints, reason: `duel:${duel.id}`, activity: true });
    }
    return true;
  });
  if (done && winnerId) await syncBadges(winnerId);
  return done;
}

/** Applique la fin du chrono : le duel est tranché à la première lecture qui suit l'échéance. */
async function settle(duel: DuelRow) {
  if (duel.status !== 'ACTIVE' || !duel.startedAt) return duel;
  if (Date.now() < duel.startedAt.getTime() + duel.durationSec * 1000) return duel;

  const total = rowsTotal(duel.challenge);
  const [a, b] = await Promise.all([
    progressOf(duel.id, duel.challengerId, total),
    progressOf(duel.id, duel.opponentId, total),
  ]);
  const fa = a.passed / a.total;
  const fb = b.passed / b.total;
  const winnerId = fa > fb ? duel.challengerId : fb > fa ? duel.opponentId : null;
  await finish(duel, winnerId, winnerId ? 'Temps écoulé : victoire à la progression.' : 'Temps écoulé : égalité.');
  return (await loadDuel(duel.id))!;
}

const otherOf = (duel: DuelRow, userId: number) => (duel.challengerId === userId ? duel.opponent : duel.challenger);

// ───────────── Vue d'ensemble ─────────────

duelsRouter.get('/duels', requireAuth('STUDENT'), async (req, res) => {
  const me = await findUser(req.auth!.sub);
  if (!me) {
    res.status(401).json({ error: 'Compte introuvable.' });
    return;
  }
  const mine = [{ challengerId: me.id }, { opponentId: me.id }];
  const promo = me.group?.promo;

  const [finished, invites, open, classmates, activeDuels, available] = await Promise.all([
    prisma.duel.findMany({
      where: { status: 'FINISHED', OR: mine },
      orderBy: { finishedAt: 'desc' },
      include: { challenge: true, challenger: true, opponent: true },
    }),
    prisma.duel.findMany({
      where: { status: 'PENDING', opponentId: me.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * MIN) } },
      orderBy: { createdAt: 'desc' },
      include: { challenge: true, challenger: true },
    }),
    prisma.duel.findFirst({
      where: { OR: [{ status: 'ACTIVE', OR: mine }, { status: 'PENDING', challengerId: me.id }] },
      select: { id: true, status: true, challengerId: true },
    }),
    prisma.user.findMany({
      where: { role: 'STUDENT', status: 'ACTIVE', id: { not: me.id }, ...(promo ? { group: { promo } } : {}) },
      orderBy: [{ lastSeenAt: { sort: 'desc', nulls: 'last' } }, { points: 'desc' }],
      take: 10,
    }),
    prisma.duel.findMany({ where: { status: 'ACTIVE' }, select: { challengerId: true, opponentId: true } }),
    prisma.challenge.findMany({ where: gradable, select: { subject: true, difficulty: true } }),
  ]);

  const inDuel = new Set(activeDuels.flatMap((d) => [d.challengerId, d.opponentId]));
  const wins = finished.filter((d) => d.winnerId === me.id).length;
  const losses = finished.filter((d) => d.winnerId && d.winnerId !== me.id).length;

  // Exercices corrigeables automatiquement, par matière et difficulté
  const counts = new Map<string, number>();
  for (const c of available) {
    const key = `${c.subject}|${c.difficulty}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  res.json({
    stats: { wins, losses, played: finished.length },
    available: [...counts.entries()].map(([key, count]) => {
      const [subject, difficulty] = key.split('|');
      return { subject: subjectLabel[subject], difficulty: difficultyLabel[difficulty], count };
    }),
    invites: invites.map((d) => ({
      id: d.id,
      name: shortName(d.challenger.firstName, d.challenger.lastName),
      initials: initials(d.challenger.firstName, d.challenger.lastName),
      subject: subjectLabel[d.challenge.subject],
      difficulty: difficultyLabel[d.challenge.difficulty],
      ranked: d.ranked,
    })),
    recent: finished.slice(0, 5).map((d) => {
      const other = d.challengerId === me.id ? d.opponent : d.challenger;
      return {
        id: d.id,
        result: d.winnerId === me.id ? 'Victoire' : d.winnerId ? 'Défaite' : 'Égalité',
        opponent: shortName(other.firstName, other.lastName),
        subject: `${subjectLabel[d.challenge.subject]} · ${difficultyLabel[d.challenge.difficulty]}`,
        points: d.winnerId === me.id && d.ranked ? d.stakePoints : 0,
      };
    }),
    opponents: classmates.map((u) => ({
      id: u.id,
      name: fullName(u),
      initials: initials(u.firstName, u.lastName),
      level: levelOf(u.xp),
      league: `Ligue ${leagueOf(u.points)}`,
      online: isOnline(u.lastSeenAt),
      status: inDuel.has(u.id)
        ? 'en-duel'
        : !u.acceptDuels
          ? 'indisponible'
          : isOnline(u.lastSeenAt)
            ? 'dispo'
            : 'hors-ligne',
    })),
    open: open ? { id: open.id, status: open.status } : null,
    stake: STAKE,
  });
});

// ───────────── Création et réponse à une invitation ─────────────

duelsRouter.post('/duels', requireAuth('STUDENT'), async (req, res) => {
  const me = await findUser(req.auth!.sub);
  if (!me) {
    res.status(401).json({ error: 'Compte introuvable.' });
    return;
  }

  const subject = subjectFromLabel[String(req.body?.subject ?? '')];
  const level = String(req.body?.difficulty ?? 'Au hasard');
  const difficulty = difficultyFromLabel[level];
  const ranked = req.body?.ranked !== false;
  if (!subject || (level !== 'Au hasard' && !difficulty)) {
    res.status(400).json({ error: 'Matière ou difficulté invalide.' });
    return;
  }

  const open = await prisma.duel.findFirst({
    where: { OR: [{ status: 'ACTIVE', OR: [{ challengerId: me.id }, { opponentId: me.id }] }, { status: 'PENDING', challengerId: me.id }] },
  });
  if (open) {
    res.status(409).json({ error: 'Tu as déjà un duel en cours.', duelId: open.id });
    return;
  }

  const challenges = await prisma.challenge.findMany({ where: { ...gradable, subject, ...(difficulty ? { difficulty } : {}) } });
  if (challenges.length === 0) {
    res.status(409).json({
      error: 'Aucun exercice corrigé automatiquement pour cette matière et ce niveau. Les duels fonctionnent pour l’instant sur les défis SQL.',
    });
    return;
  }

  // Adversaire choisi, ou tiré au hasard parmi les camarades disponibles (de préférence en ligne).
  const busy = new Set(
    (await prisma.duel.findMany({ where: { status: 'ACTIVE' }, select: { challengerId: true, opponentId: true } })).flatMap((d) => [
      d.challengerId,
      d.opponentId,
    ]),
  );
  const wanted = ID(req.body?.opponentId);
  let opponentId: number;
  if (wanted) {
    const o = await prisma.user.findFirst({ where: { id: wanted, role: 'STUDENT', status: 'ACTIVE' } });
    if (!o || o.id === me.id) {
      res.status(404).json({ error: 'Adversaire introuvable.' });
      return;
    }
    if (!o.acceptDuels || busy.has(o.id)) {
      res.status(409).json({ error: `${o.firstName} n’est pas disponible pour un duel.` });
      return;
    }
    opponentId = o.id;
  } else {
    const pool = await prisma.user.findMany({
      where: { role: 'STUDENT', status: 'ACTIVE', acceptDuels: true, id: { not: me.id }, ...(me.group?.promo ? { group: { promo: me.group.promo } } : {}) },
    });
    const free = pool.filter((u) => !busy.has(u.id));
    const online = free.filter((u) => isOnline(u.lastSeenAt));
    const chosen = pick(online.length > 0 ? online : free);
    if (!chosen) {
      res.status(409).json({ error: 'Aucun camarade n’est disponible pour un duel pour le moment.' });
      return;
    }
    opponentId = chosen.id;
  }

  const duel = await prisma.duel.create({
    data: {
      challengerId: me.id,
      opponentId,
      challengeId: pick(challenges).id,
      ranked,
      stakePoints: ranked ? STAKE : 0,
      durationSec: DURATION_SEC,
    },
  });
  res.status(201).json({ id: duel.id });
});

duelsRouter.post('/duels/:id/accept', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const userId = req.auth!.sub;
  const duel = id ? await loadDuel(id) : null;
  if (!duel || duel.opponentId !== userId) {
    res.status(404).json({ error: 'Invitation introuvable.' });
    return;
  }
  if (duel.status !== 'PENDING') {
    res.status(409).json({ error: 'Cette invitation n’est plus valable.' });
    return;
  }
  const busy = await prisma.duel.count({
    where: { status: 'ACTIVE', OR: [{ challengerId: userId }, { opponentId: userId }, { challengerId: duel.challengerId }, { opponentId: duel.challengerId }] },
  });
  if (busy > 0) {
    res.status(409).json({ error: 'Toi ou ton adversaire êtes déjà dans un duel.' });
    return;
  }

  const started = await prisma.duel.updateMany({
    where: { id: duel.id, status: 'PENDING' },
    data: { status: 'ACTIVE', startedAt: new Date() },
  });
  if (started.count === 1) await prisma.duelEvent.create({ data: { duelId: duel.id, text: 'Le duel a commencé.' } });
  res.json({ id: duel.id });
});

/** Refus (par l'adversaire) ou annulation (par l'étudiant qui a lancé l'invitation). */
duelsRouter.post('/duels/:id/decline', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const userId = req.auth!.sub;
  const duel = id ? await loadDuel(id) : null;
  if (!duel || (duel.opponentId !== userId && duel.challengerId !== userId)) {
    res.status(404).json({ error: 'Duel introuvable.' });
    return;
  }
  await prisma.duel.updateMany({ where: { id: duel.id, status: 'PENDING' }, data: { status: 'DECLINED', finishedAt: new Date() } });
  res.json({ ok: true });
});

duelsRouter.post('/duels/:id/abandon', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const userId = req.auth!.sub;
  const duel = id ? await loadDuel(id) : null;
  if (!duel || (duel.opponentId !== userId && duel.challengerId !== userId)) {
    res.status(404).json({ error: 'Duel introuvable.' });
    return;
  }
  if (duel.status === 'ACTIVE') await finish(duel, otherOf(duel, userId).id, 'Duel abandonné.');
  else if (duel.status === 'PENDING') {
    await prisma.duel.updateMany({ where: { id: duel.id, status: 'PENDING' }, data: { status: 'DECLINED', finishedAt: new Date() } });
  }
  res.json({ ok: true });
});

// ───────────── Duel en direct ─────────────

const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

duelsRouter.get('/duels/:id', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const userId = req.auth!.sub;
  let duel = id ? await loadDuel(id) : null;
  if (!duel || (duel.opponentId !== userId && duel.challengerId !== userId)) {
    res.status(404).json({ error: 'Duel introuvable.' });
    return;
  }
  duel = await settle(duel);

  const meUser = duel.challengerId === userId ? duel.challenger : duel.opponent;
  const other = otherOf(duel, userId);
  const c = duel.challenge;
  const total = rowsTotal(c);

  const [mine, theirs, events, last] = await Promise.all([
    progressOf(duel.id, userId, total),
    progressOf(duel.id, other.id, total),
    prisma.duelEvent.findMany({ where: { duelId: duel.id }, orderBy: { createdAt: 'asc' } }),
    prisma.attempt.findFirst({ where: { duelId: duel.id, userId }, orderBy: { createdAt: 'desc' } }),
  ]);

  const startedAt = duel.startedAt;
  const remainingSec =
    duel.status === 'ACTIVE' && startedAt
      ? Math.max(0, Math.ceil((startedAt.getTime() + duel.durationSec * 1000 - Date.now()) / 1000))
      : duel.status === 'PENDING'
        ? duel.durationSec
        : 0;

  const player = (u: typeof meUser, p: { passed: number; total: number }) => ({
    name: fullName(u),
    initials: initials(u.firstName, u.lastName),
    sub: `${u.group?.name ?? 'IUT d’Amiens'} · Ligue ${leagueOf(u.points)}`,
    passed: p.passed,
    total: p.total,
  });

  const feedback = (last?.feedback ?? null) as { message?: string; error?: string; expected?: unknown; obtained?: unknown } | null;

  res.json({
    id: duel.id,
    status: duel.status,
    ranked: duel.ranked,
    stake: duel.ranked ? duel.stakePoints : 0,
    iAmChallenger: duel.challengerId === userId,
    durationSec: duel.durationSec,
    remainingSec,
    challenge: {
      id: c.id,
      title: c.title,
      statement: c.statement,
      subject: subjectLabel[c.subject],
      difficulty: difficultyLabel[c.difficulty],
      starterCode: c.starterCode ?? '',
      tables: c.setupSql ? describeTables(c.setupSql) : [],
    },
    me: player(meUser, mine),
    opponent: player(other, theirs),
    winner: duel.status === 'FINISHED' ? (duel.winnerId === userId ? 'me' : duel.winnerId ? 'opponent' : 'draw') : null,
    feed: events.map((e) => ({
      time: fmtTime(e.createdAt.getTime() - (startedAt ?? duel.createdAt).getTime()),
      who: e.userId === null ? '' : e.userId === userId ? 'Vous' : other.firstName,
      text: e.text,
    })),
    lastResult: last
      ? {
          status: last.status,
          message: feedback?.error ?? feedback?.message ?? '',
          expected: feedback?.expected ?? null,
          obtained: feedback?.obtained ?? null,
        }
      : null,
  });
});

/** Exécute la requête sur le jeu de données du duel, sans la soumettre. */
duelsRouter.post('/duels/:id/run', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const userId = req.auth!.sub;
  const duel = id ? await loadDuel(id) : null;
  if (!duel || (duel.opponentId !== userId && duel.challengerId !== userId) || duel.status !== 'ACTIVE') {
    res.status(404).json({ error: 'Duel introuvable ou terminé.' });
    return;
  }
  res.json(runQuery(duel.challenge.setupSql ?? '', String(req.body?.query ?? '')));
});

/** Soumet une réponse : elle est corrigée tout de suite, et la première réussite gagne le duel. */
duelsRouter.post('/duels/:id/submit', requireAuth('STUDENT'), async (req, res) => {
  const id = ID(req.params.id);
  const userId = req.auth!.sub;
  const answer = String(req.body?.answer ?? '');
  let duel = id ? await loadDuel(id) : null;
  if (!duel || (duel.opponentId !== userId && duel.challengerId !== userId)) {
    res.status(404).json({ error: 'Duel introuvable.' });
    return;
  }
  duel = await settle(duel);
  if (duel.status !== 'ACTIVE') {
    res.status(409).json({ error: 'Ce duel est terminé.' });
    return;
  }
  const c = duel.challenge;
  if (!c.setupSql || !c.solutionSql) {
    res.status(501).json({ error: 'Ce défi n’a pas de correction automatique.' });
    return;
  }

  const verdict = judge(c.setupSql, c.solutionSql, answer, orderMattersOf(c));
  if ('error' in verdict) {
    await prisma.attempt.create({
      data: { userId, challengeId: c.id, duelId: duel.id, answer, status: 'ERROR', feedback: { error: verdict.error } },
    });
    res.json({ status: 'ERROR', message: verdict.error });
    return;
  }

  const before = await progressOf(duel.id, userId, verdict.testsTotal);
  await prisma.attempt.create({
    data: {
      userId,
      challengeId: c.id,
      duelId: duel.id,
      answer,
      status: verdict.passed ? 'PASSED' : 'FAILED',
      testsPassed: verdict.testsPassed,
      testsTotal: verdict.testsTotal,
      feedback: JSON.parse(JSON.stringify({ expected: verdict.expected, obtained: verdict.obtained, message: verdict.message })),
    },
  });

  let won = false;
  if (verdict.passed) {
    won = await finish(duel, userId, 'Solution validée : victoire !');
  } else if (verdict.testsPassed > before.passed) {
    await prisma.duelEvent.create({
      data: { duelId: duel.id, userId, text: `Progression : ${verdict.testsPassed} / ${verdict.testsTotal} lignes.` },
    });
  }

  res.json({
    status: verdict.passed ? 'PASSED' : 'FAILED',
    message: verdict.message,
    testsPassed: verdict.testsPassed,
    testsTotal: verdict.testsTotal,
    expected: verdict.expected,
    obtained: verdict.obtained,
    won,
  });
});
