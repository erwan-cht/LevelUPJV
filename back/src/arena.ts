// Arène live : l'enseignant lance une séance de défis SQL, les étudiants rejoignent avec un code (ou un QR code),
// tous résolvent les mêmes défis en même temps, le classement et l'analyse de la salle s'affichent en direct (W-02 / W-03).
//
// Temps réel : Server-Sent Events (un flux par écran), sans dépendance ni réglage du serveur web. Tout l'état de la séance
// est en base : un redémarrage du serveur (déploiement) ne casse pas une séance, les écrans se reconnectent seuls.
import type { Request, Response } from 'express';
import { Router } from 'express';
import { analyse, leaderboard, newJoinCode, normalizeCode, resultOf, STEP_LABEL, type Analysis, type Attempt } from './arenaLogic.js';
import { requireAuth } from './auth.js';
import { defaultCourse, pagesForStep, type StepKey } from './courses.js';
import { prisma } from './db.js';
import { describeTables, judge } from './sql.js';
import { explainAttempt } from './sqlsteps.js';

export const arenaRouter = Router();

const GRACE_MS = 1500; // marge réseau avant de refuser une réponse
const MAX_ATTEMPTS = 15; // tentatives par étudiant et par défi
const MIN_GAP_MS = 1200; // délai minimal entre deux envois d'un même étudiant

// ───────────── Chargement et vue d'une séance ─────────────

const include = {
  challenges: { include: { challenge: true }, orderBy: { position: 'asc' as const } },
  participants: { include: { user: { select: { id: true, pseudo: true } } }, orderBy: { joinedAt: 'asc' as const } },
};

async function load(code: string) {
  const s = await prisma.arenaSession.findUnique({ where: { joinCode: code }, include });
  if (!s) return null;
  const rows = await prisma.arenaAnswer.findMany({ where: { arenaId: s.id }, orderBy: { createdAt: 'asc' } });
  const attempts: Attempt[] = rows.map((r) => ({ userId: r.userId, challengeId: r.challengeId, correct: r.correct, failedStep: r.failedStep, elapsedMs: r.elapsedMs }));
  return { s, attempts };
}
type Core = NonNullable<Awaited<ReturnType<typeof load>>>;

const tablesCache = new Map<number, ReturnType<typeof describeTables>>();
const tablesOf = (id: number, setupSql: string | null) => {
  if (!setupSql) return [];
  let t = tablesCache.get(id);
  if (!t) {
    t = describeTables(setupSql);
    tablesCache.set(id, t);
  }
  return t;
};

type Viewer = { userId: number; host: boolean };

const KEY_OF = Object.fromEntries(Object.entries(STEP_LABEL).map(([key, label]) => [label, key])) as Record<string, StepKey>;

/** Pages du cours à revoir pour l'étape où la salle a le plus buté (le cours est facultatif). */
function reviewFor(a?: Analysis) {
  const course = defaultCourse();
  const key = a?.byStep[0] && KEY_OF[a.byStep[0].step];
  if (!course || !key) return undefined;
  const pages = pagesForStep(course, key);
  return pages.length ? { course: { id: course.id, title: course.title, author: course.author, total: course.pages.length }, pages } : undefined;
}

/** Ce que voit un écran : l'enseignant (projecteur) en sait plus qu'un étudiant (solution, analyse, liste de la salle). */
function view(core: Core, viewer: Viewer) {
  const { s, attempts } = core;
  const limitMs = s.timeLimitSec * 1000;
  const people = s.participants.map((p) => ({ userId: p.userId, pseudo: p.user.pseudo }));
  const names = new Map(people.map((p) => [p.userId, p.pseudo]));
  const phase = s.status === 'LOBBY' ? 'lobby' : s.status === 'FINISHED' ? 'finished' : s.revealed ? 'reveal' : 'question';
  const item = s.challenges[s.currentIndex];
  const current = phase === 'lobby' || phase === 'finished' ? undefined : item?.challenge;

  const board = leaderboard(people.map((p) => p.userId), attempts, limitMs);
  const row = (r: (typeof board)[number]) => ({ pseudo: names.get(r.userId) ?? '?', points: r.points, solved: r.solved, rank: r.rank });
  const mine = board.find((r) => r.userId === viewer.userId);
  const mineOnCurrent = current ? attempts.filter((a) => a.userId === viewer.userId && a.challengeId === current.id) : [];
  const forCurrent = current ? attempts.filter((a) => a.challengeId === current.id) : [];
  const currentResult = resultOf(mineOnCurrent, limitMs);

  const endsAt = s.questionStartedAt && phase === 'question' ? s.questionStartedAt.getTime() + limitMs : null;
  const base = {
    code: s.joinCode,
    phase,
    index: s.currentIndex,
    total: s.challenges.length,
    joined: people.length,
    serverNow: Date.now(),
    endsAt,
    timeLimitSec: s.timeLimitSec,
    challenge: current && {
      id: current.id,
      title: current.title,
      statement: current.statement,
      difficulty: current.difficulty,
      starterCode: current.starterCode ?? '',
      tables: tablesOf(current.id, current.setupSql),
    },
    leaderboard: board.slice(0, 10).map(row),
  };

  if (viewer.host) {
    const analyses = s.challenges.map((c) => ({
      id: c.challenge.id,
      title: c.challenge.title,
      analysis: analyse(people.length, attempts.filter((a) => a.challengeId === c.challenge.id), limitMs),
    }));
    return {
      ...base,
      role: 'host' as const,
      people: s.participants.map((p) => p.user.pseudo),
      titles: s.challenges.map((c) => c.challenge.title),
      answered: new Set(forCurrent.map((a) => a.userId)).size,
      solvedCount: new Set(forCurrent.filter((a) => a.correct).map((a) => a.userId)).size,
      analysis: phase === 'reveal' ? analyses[s.currentIndex]?.analysis : undefined,
      analyses: phase === 'finished' ? analyses : undefined,
      solution: phase === 'reveal' ? current?.solutionSql : undefined,
      full: phase === 'finished' ? board.map(row) : undefined,
      review:
        phase === 'reveal'
          ? reviewFor(analyses[s.currentIndex]?.analysis)
          : phase === 'finished'
            ? reviewFor([...analyses].filter((x) => x.analysis.answered > 0).sort((a, b) => a.analysis.successPct - b.analysis.successPct)[0]?.analysis)
            : undefined,
    };
  }
  return {
    ...base,
    role: 'player' as const,
    me: mine && { rank: mine.rank, points: mine.points, solved: mine.solved, outOf: people.length },
    current: current && { solved: currentResult.solved, attempts: currentResult.attempts, points: currentResult.points },
    full: phase === 'finished' ? board.map(row) : undefined,
  };
}

// ───────────── Diffusion en direct (SSE) ─────────────

interface Sub extends Viewer {
  res: Response;
}
const subs = new Map<string, Set<Sub>>();
const pending = new Map<string, NodeJS.Timeout>();

async function flush(code: string) {
  const set = subs.get(code);
  if (!set?.size) return;
  const core = await load(code);
  if (!core) return;
  for (const sub of set) {
    try {
      sub.res.write(`data: ${JSON.stringify(view(core, sub))}\n\n`);
    } catch {
      set.delete(sub);
    }
  }
}

/** Plusieurs changements en quelques instants (30 étudiants qui répondent) ne produisent qu'une seule diffusion. */
function broadcast(code: string) {
  if (pending.has(code)) return;
  pending.set(
    code,
    setTimeout(() => {
      pending.delete(code);
      flush(code).catch((e) => console.error('Arène : diffusion impossible', e));
    }, 250),
  );
}

// ───────────── Fin automatique du temps ─────────────

const timers = new Map<string, NodeJS.Timeout>();

/** Quand le temps est écoulé, la séance passe seule à l'analyse (sans attendre l'enseignant). */
function scheduleReveal(code: string, index: number, endsAt: number) {
  clearTimeout(timers.get(code));
  timers.set(
    code,
    setTimeout(async () => {
      timers.delete(code);
      try {
        const done = await prisma.arenaSession.updateMany({ where: { joinCode: code, status: 'RUNNING', revealed: false, currentIndex: index }, data: { revealed: true } });
        if (done.count) broadcast(code);
      } catch (e) {
        console.error('Arène : fin du temps impossible', e);
      }
    }, Math.max(0, endsAt - Date.now()) + GRACE_MS),
  );
}

/** Après un redémarrage du serveur : on reprend les comptes à rebours des séances en cours. */
async function resume() {
  try {
    const live = await prisma.arenaSession.findMany({ where: { status: 'RUNNING', revealed: false, questionStartedAt: { not: null } } });
    for (const s of live) scheduleReveal(s.joinCode, s.currentIndex, s.questionStartedAt!.getTime() + s.timeLimitSec * 1000);
  } catch (e) {
    console.error('Arène : reprise impossible', e);
  }
}
setTimeout(resume, 3000);

// ───────────── Enseignant ─────────────

const hostOnly = requireAuth('TEACHER', 'ADMIN');
const userOf = (req: Request) => req.auth!.sub;

/** Défis utilisables en arène : publiés, SQL, corrigés automatiquement. */
arenaRouter.get('/arena/challenges', hostOnly, async (_req, res) => {
  const list = await prisma.challenge.findMany({
    where: { status: 'PUBLISHED', type: 'SQL', setupSql: { not: null }, solutionSql: { not: null } },
    orderBy: [{ difficulty: 'asc' }, { id: 'asc' }],
    select: { id: true, title: true, difficulty: true, minutes: true },
  });
  res.json({ items: list });
});

/** Séances de l'enseignant encore ouvertes (pour reprendre après une coupure). */
arenaRouter.get('/arena/mine', hostOnly, async (req, res) => {
  const list = await prisma.arenaSession.findMany({
    where: { hostId: userOf(req), status: { not: 'FINISHED' }, createdAt: { gte: new Date(Date.now() - 12 * 3_600_000) } },
    orderBy: { createdAt: 'desc' },
    select: { joinCode: true, status: true, createdAt: true, _count: { select: { participants: true, challenges: true } } },
  });
  res.json({ items: list.map((s) => ({ code: s.joinCode, status: s.status, createdAt: s.createdAt, participants: s._count.participants, challenges: s._count.challenges })) });
});

arenaRouter.post('/arena', hostOnly, async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.challengeIds) ? req.body.challengeIds : []).map(Number).filter(Number.isInteger))] as number[];
  if (ids.length < 1 || ids.length > 8) {
    res.status(400).json({ error: 'Choisis entre 1 et 8 défis.' });
    return;
  }
  const found = await prisma.challenge.findMany({ where: { id: { in: ids }, status: 'PUBLISHED', type: 'SQL', setupSql: { not: null }, solutionSql: { not: null } }, select: { id: true } });
  if (found.length !== ids.length) {
    res.status(400).json({ error: 'Certains défis ne sont pas utilisables en arène.' });
    return;
  }
  const timeLimitSec = Math.max(60, Math.min(900, Number(req.body?.timeLimitSec) || 240));

  for (let attempt = 0; attempt < 8; attempt++) {
    const joinCode = newJoinCode();
    try {
      const s = await prisma.arenaSession.create({
        data: { hostId: userOf(req), joinCode, timeLimitSec, challenges: { create: ids.map((challengeId, position) => ({ challengeId, position })) } },
      });
      res.json({ code: s.joinCode });
      return;
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e; // code déjà pris : on en tire un autre
    }
  }
  res.status(503).json({ error: 'Impossible de créer la salle. Réessaie.' });
});

/** Récupère la séance de l'enseignant connecté, ou répond à sa place. */
async function mySession(req: Request, res: Response) {
  const code = normalizeCode(req.params.code);
  const s = await prisma.arenaSession.findUnique({ where: { joinCode: code }, include: { challenges: true } });
  if (!s || s.hostId !== userOf(req)) {
    res.status(404).json({ error: 'Salle introuvable.' });
    return null;
  }
  return s;
}

arenaRouter.post('/arena/:code/start', hostOnly, async (req, res) => {
  const s = await mySession(req, res);
  if (!s) return;
  if (s.status !== 'LOBBY') {
    res.status(409).json({ error: 'La séance a déjà commencé.' });
    return;
  }
  const now = new Date();
  await prisma.arenaSession.update({ where: { id: s.id }, data: { status: 'RUNNING', startedAt: now, currentIndex: 0, revealed: false, questionStartedAt: now } });
  scheduleReveal(s.joinCode, 0, now.getTime() + s.timeLimitSec * 1000);
  broadcast(s.joinCode);
  res.json({ ok: true });
});

/** Fin de la question, avant la fin du temps. */
arenaRouter.post('/arena/:code/reveal', hostOnly, async (req, res) => {
  const s = await mySession(req, res);
  if (!s) return;
  if (s.status !== 'RUNNING' || s.revealed) {
    res.status(409).json({ error: 'Aucune question en cours.' });
    return;
  }
  clearTimeout(timers.get(s.joinCode));
  await prisma.arenaSession.update({ where: { id: s.id }, data: { revealed: true } });
  broadcast(s.joinCode);
  res.json({ ok: true });
});

arenaRouter.post('/arena/:code/next', hostOnly, async (req, res) => {
  const s = await mySession(req, res);
  if (!s) return;
  if (s.status !== 'RUNNING') {
    res.status(409).json({ error: 'La séance n’est pas en cours.' });
    return;
  }
  const next = s.currentIndex + 1;
  if (next >= s.challenges.length) {
    await prisma.arenaSession.update({ where: { id: s.id }, data: { status: 'FINISHED', finishedAt: new Date(), revealed: true } });
  } else {
    const now = new Date();
    await prisma.arenaSession.update({ where: { id: s.id }, data: { currentIndex: next, revealed: false, questionStartedAt: now } });
    scheduleReveal(s.joinCode, next, now.getTime() + s.timeLimitSec * 1000);
  }
  broadcast(s.joinCode);
  res.json({ ok: true });
});

arenaRouter.post('/arena/:code/finish', hostOnly, async (req, res) => {
  const s = await mySession(req, res);
  if (!s) return;
  clearTimeout(timers.get(s.joinCode));
  await prisma.arenaSession.update({ where: { id: s.id }, data: { status: 'FINISHED', finishedAt: new Date(), revealed: true } });
  broadcast(s.joinCode);
  res.json({ ok: true });
});

// ───────────── Étudiants ─────────────

arenaRouter.post('/arena/join', requireAuth('STUDENT'), async (req, res) => {
  const code = normalizeCode(req.body?.code);
  const s = code ? await prisma.arenaSession.findUnique({ where: { joinCode: code } }) : null;
  if (!s || s.status === 'FINISHED') {
    res.status(404).json({ error: 'Aucune salle ouverte avec ce code.' });
    return;
  }
  await prisma.arenaParticipant.upsert({ where: { arenaId_userId: { arenaId: s.id, userId: userOf(req) } }, update: {}, create: { arenaId: s.id, userId: userOf(req) } });
  broadcast(s.joinCode);
  res.json({ code: s.joinCode });
});

const lastSent = new Map<string, number>();

arenaRouter.post('/arena/:code/answer', requireAuth('STUDENT'), async (req, res) => {
  const userId = userOf(req);
  const code = normalizeCode(req.params.code);
  const s = await prisma.arenaSession.findUnique({ where: { joinCode: code }, include: { challenges: { include: { challenge: true }, orderBy: { position: 'asc' } } } });
  const joined = s && (await prisma.arenaParticipant.findUnique({ where: { arenaId_userId: { arenaId: s.id, userId } } }));
  if (!s || !joined) {
    res.status(403).json({ error: 'Rejoins d’abord la salle.' });
    return;
  }
  const c = s.challenges[s.currentIndex]?.challenge;
  const started = s.questionStartedAt?.getTime();
  if (s.status !== 'RUNNING' || s.revealed || !c || !started || Date.now() > started + s.timeLimitSec * 1000 + GRACE_MS) {
    res.status(409).json({ error: 'Le temps est écoulé pour ce défi.' });
    return;
  }
  const query = String(req.body?.query ?? '').trim().replace(/;+\s*$/, '');
  if (!query || query.includes(';') || !/^(select|with)\b/i.test(query)) {
    res.status(400).json({ error: 'Écris une seule requête SELECT.' });
    return;
  }
  if (!c.setupSql || !c.solutionSql) {
    res.status(400).json({ error: 'Ce défi n’est pas corrigé automatiquement.' });
    return;
  }

  const before = await prisma.arenaAnswer.findMany({ where: { arenaId: s.id, userId, challengeId: c.id } });
  if (before.some((a) => a.correct)) {
    res.json({ correct: true, already: true, message: 'Tu as déjà réussi ce défi.' });
    return;
  }
  if (before.length >= MAX_ATTEMPTS) {
    res.status(429).json({ error: 'Trop de tentatives sur ce défi.' });
    return;
  }
  // Une vraie tentative à la fois (seules les tentatives corrigées comptent pour le délai).
  const key = `${s.id}:${userId}`;
  if (Date.now() - (lastSent.get(key) ?? 0) < MIN_GAP_MS) {
    res.status(429).json({ error: 'Doucement : une réponse à la fois.' });
    return;
  }
  lastSent.set(key, Date.now());

  // Correction + étape où la requête s'écarte de la solution (alimente l'analyse de la salle).
  const verdict = judge(c.setupSql, c.solutionSql, query);
  let correct = false;
  let failedStep: string | null = null;
  let message: string;
  if ('error' in verdict) {
    failedStep = 'SYNTAXE';
    message = verdict.error;
  } else {
    correct = verdict.passed;
    message = verdict.message;
    if (!correct) {
      const e = explainAttempt(c.setupSql, c.solutionSql, query);
      // L'étape fautive, ou celle qu'il manque (un WHERE oublié compte comme « WHERE », pas comme « SELECT »).
      failedStep = e.divergeKind ? (STEP_LABEL[e.divergeKind] ?? 'AUTRE') : 'RÉSULTAT';
    }
  }

  const elapsedMs = Math.max(0, Date.now() - started);
  await prisma.arenaAnswer.create({ data: { arenaId: s.id, userId, challengeId: c.id, answer: query.slice(0, 4000), correct, failedStep, elapsedMs } });
  const result = resultOf([...before.map((a) => ({ userId, challengeId: c.id, correct: a.correct, failedStep: a.failedStep, elapsedMs: a.elapsedMs })), { userId, challengeId: c.id, correct, failedStep, elapsedMs }], s.timeLimitSec * 1000);
  broadcast(s.joinCode);
  res.json({ correct, message: correct ? 'Bonne réponse !' : message, attempts: before.length + 1, points: result.points });
});

// ───────────── Flux en direct ─────────────

arenaRouter.get('/arena/:code/stream', requireAuth(), async (req, res) => {
  const userId = userOf(req);
  const core = await load(normalizeCode(req.params.code));
  if (!core) {
    res.status(404).json({ error: 'Salle introuvable.' });
    return;
  }
  const host = core.s.hostId === userId;
  if (!host && !core.s.participants.some((p) => p.userId === userId)) {
    res.status(403).json({ error: 'Rejoins d’abord la salle.' });
    return;
  }

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx : ne pas mettre le flux en mémoire tampon
  });
  res.flushHeaders();

  const sub: Sub = { res, userId, host };
  const code = core.s.joinCode;
  const set = subs.get(code) ?? new Set<Sub>();
  set.add(sub);
  subs.set(code, set);

  res.write(`data: ${JSON.stringify(view(core, sub))}\n\n`);
  const beat = setInterval(() => res.write(': ping\n\n'), 10_000); // nginx coupe un flux silencieux au bout de 15 s
  req.on('close', () => {
    clearInterval(beat);
    set.delete(sub);
    if (!set.size) subs.delete(code);
  });
});
