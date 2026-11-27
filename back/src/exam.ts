// Examen surveillé : l'enseignant lance un examen de défis SQL, les étudiants entrent avec le code donné en cours.
// Quitter la page (autre onglet, autre fenêtre, page fermée ou rechargée) bloque la copie : le serveur refuse alors
// toute exécution et tout enregistrement. L'enseignant est alerté en direct et choisit de débloquer l'étudiant ou de
// clore sa copie.
//
// Comme l'Arène : temps réel par Server-Sent Events, tout l'état en base (un redémarrage ne perd ni les copies ni les blocages).
import type { Request, Response } from 'express';
import { Router } from 'express';
import { newJoinCode, normalizeCode } from './arenaLogic.js';
import { requireAuth } from './auth.js';
import { prisma } from './db.js';
import {
  MAX_CHALLENGES,
  applyDecision,
  applyLeave,
  canWork,
  clampDuration,
  endsAtOf,
  gradeOn20,
  isOverdue,
  leaveReason,
  sortSeats,
} from './examLogic.js';
import { describeTables, judge, runQuery } from './sql.js';

export const examRouter = Router();

const GRACE_MS = 3000; // marge réseau à la fin du temps
const MIN_GAP_MS = 800; // délai minimal entre deux exécutions d'un même étudiant
const userOf = (req: Request) => req.auth!.sub;
const hostOnly = requireAuth('TEACHER', 'ADMIN');
const studentOnly = requireAuth('STUDENT');

const playable = { status: 'PUBLISHED' as const, type: 'SQL' as const, setupSql: { not: null }, solutionSql: { not: null } };

// ───────────── Chargement ─────────────

const include = {
  challenges: { include: { challenge: true }, orderBy: { position: 'asc' as const } },
  participants: { include: { user: { select: { id: true, pseudo: true, firstName: true, lastName: true } } } },
};

async function load(code: string) {
  let s = await prisma.examSession.findUnique({ where: { joinCode: code }, include });
  if (!s) return null;
  // Temps écoulé sans que le minuteur ait pu clore l'examen (serveur redémarré) : on le clôt maintenant.
  if (isOverdue(s.status, s.startedAt, s.durationMin, Date.now())) {
    await prisma.examSession.updateMany({ where: { id: s.id, status: 'RUNNING' }, data: { status: 'FINISHED', finishedAt: new Date(endsAtOf(s.startedAt, s.durationMin)!) } });
    s = (await prisma.examSession.findUnique({ where: { joinCode: code }, include }))!;
  }
  const answers = await prisma.examAnswer.findMany({ where: { examId: s.id } });
  const events = await prisma.examEvent.findMany({
    where: { examId: s.id },
    orderBy: { id: 'desc' },
    take: 60,
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  return { s, answers, events };
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

const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();

// ───────────── Ce que voit chaque écran ─────────────

interface Viewer {
  userId: number;
  host: boolean;
}

function view(core: Core, viewer: Viewer) {
  const { s, answers, events } = core;
  const total = s.challenges.length;
  const base = {
    code: s.joinCode,
    title: s.title,
    status: s.status,
    durationMin: s.durationMin,
    total,
    serverNow: Date.now(),
    endsAt: endsAtOf(s.startedAt, s.durationMin),
  };

  if (viewer.host) {
    const seats = sortSeats(
      s.participants.map((p) => {
        const mine = answers.filter((a) => a.userId === p.userId);
        const correct = mine.filter((a) => a.correct).length;
        return {
          userId: p.userId,
          name: fullName(p.user),
          pseudo: p.user.pseudo,
          status: p.status,
          leaveCount: p.leaveCount,
          lockedAt: p.lockedAt,
          lockReason: p.lockReason,
          answered: mine.length,
          correct,
          grade: gradeOn20(correct, total),
          online: isOnline(s.joinCode, p.userId),
        };
      }),
    );
    return {
      ...base,
      role: 'host' as const,
      challenges: s.challenges.map((c) => ({ id: c.challenge.id, title: c.challenge.title, difficulty: c.challenge.difficulty })),
      seats,
      events: events.map((e) => ({ id: e.id, kind: e.kind, detail: e.detail, name: fullName(e.user), userId: e.userId, at: e.createdAt })),
    };
  }

  const seat = s.participants.find((p) => p.userId === viewer.userId);
  const mine = answers.filter((a) => a.userId === viewer.userId);
  // Les énoncés ne sont envoyés qu'à un étudiant qui compose : un étudiant bloqué ne les voit plus.
  const working = !!seat && canWork(s.status, seat.status, s.startedAt, s.durationMin, Date.now(), GRACE_MS);
  const correct = mine.filter((a) => a.correct).length;
  return {
    ...base,
    role: 'student' as const,
    me: seat && { status: seat.status, leaveCount: seat.leaveCount, lockReason: seat.lockReason, lockedAt: seat.lockedAt },
    challenges: working
      ? s.challenges.map((c) => ({
          id: c.challenge.id,
          title: c.challenge.title,
          statement: c.challenge.statement,
          difficulty: c.challenge.difficulty,
          starterCode: c.challenge.starterCode ?? '',
          tables: tablesOf(c.challenge.id, c.challenge.setupSql),
        }))
      : [],
    saved: Object.fromEntries(mine.map((a) => [a.challengeId, a.answer])),
    // La note n'est montrée qu'une fois l'examen terminé.
    result: s.status === 'FINISHED' ? { correct, total, grade: gradeOn20(correct, total) } : undefined,
  };
}

// ───────────── Diffusion en direct (SSE) ─────────────

interface Sub extends Viewer {
  res: Response;
}
const subs = new Map<string, Set<Sub>>();
const pending = new Map<string, NodeJS.Timeout>();

const isOnline = (code: string, userId: number) => [...(subs.get(code) ?? [])].some((s) => s.userId === userId && !s.host);

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

/** Regroupe les changements rapprochés en une seule diffusion (courte : une alerte doit arriver vite). */
function broadcast(code: string) {
  if (pending.has(code)) return;
  pending.set(
    code,
    setTimeout(() => {
      pending.delete(code);
      flush(code).catch((e) => console.error('Examen : diffusion impossible', e));
    }, 120),
  );
}

// ───────────── Fin automatique ─────────────

const timers = new Map<string, NodeJS.Timeout>();

function scheduleEnd(code: string, endsAt: number) {
  clearTimeout(timers.get(code));
  // setTimeout ne dépasse pas ~24 j : un examen dure au plus 4 h, pas de souci.
  timers.set(
    code,
    setTimeout(async () => {
      timers.delete(code);
      try {
        const done = await prisma.examSession.updateMany({ where: { joinCode: code, status: 'RUNNING' }, data: { status: 'FINISHED', finishedAt: new Date() } });
        if (done.count) broadcast(code);
      } catch (e) {
        console.error('Examen : clôture impossible', e);
      }
    }, Math.max(0, endsAt - Date.now()) + GRACE_MS),
  );
}

async function resume() {
  try {
    const live = await prisma.examSession.findMany({ where: { status: 'RUNNING', startedAt: { not: null } } });
    for (const s of live) scheduleEnd(s.joinCode, endsAtOf(s.startedAt, s.durationMin)!);
  } catch (e) {
    console.error('Examen : reprise impossible', e);
  }
}
setTimeout(resume, 3000);

const log = (examId: number, userId: number, kind: string, detail = '') => prisma.examEvent.create({ data: { examId, userId, kind, detail } });

// ───────────── Enseignant ─────────────

examRouter.get('/exams/challenges', hostOnly, async (_req, res) => {
  const list = await prisma.challenge.findMany({
    where: playable,
    orderBy: [{ difficulty: 'asc' }, { id: 'asc' }],
    select: { id: true, title: true, difficulty: true, minutes: true },
  });
  res.json({ items: list });
});

examRouter.get('/exams/mine', hostOnly, async (req, res) => {
  const list = await prisma.examSession.findMany({
    where: { hostId: userOf(req) },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { joinCode: true, title: true, status: true, durationMin: true, createdAt: true, _count: { select: { participants: true, challenges: true } } },
  });
  res.json({
    items: list.map((s) => ({
      code: s.joinCode,
      title: s.title,
      status: s.status,
      durationMin: s.durationMin,
      createdAt: s.createdAt,
      participants: s._count.participants,
      challenges: s._count.challenges,
    })),
  });
});

examRouter.post('/exams', hostOnly, async (req, res) => {
  const title = String(req.body?.title ?? '').trim().slice(0, 120) || 'Examen';
  const ids = [...new Set((Array.isArray(req.body?.challengeIds) ? req.body.challengeIds : []).map(Number).filter(Number.isInteger))] as number[];
  if (ids.length < 1 || ids.length > MAX_CHALLENGES) {
    res.status(400).json({ error: `Choisis entre 1 et ${MAX_CHALLENGES} défis.` });
    return;
  }
  const found = await prisma.challenge.count({ where: { id: { in: ids }, ...playable } });
  if (found !== ids.length) {
    res.status(400).json({ error: 'Certains défis ne sont pas corrigés automatiquement.' });
    return;
  }
  const durationMin = clampDuration(req.body?.durationMin);

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const s = await prisma.examSession.create({
        data: { hostId: userOf(req), title, joinCode: newJoinCode(), durationMin, challenges: { create: ids.map((challengeId, position) => ({ challengeId, position })) } },
      });
      res.json({ code: s.joinCode });
      return;
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e; // code déjà pris : on en tire un autre
    }
  }
  res.status(503).json({ error: 'Impossible de créer l’examen. Réessaie.' });
});

async function myExam(req: Request, res: Response) {
  const s = await prisma.examSession.findUnique({ where: { joinCode: normalizeCode(req.params.code) } });
  if (!s || s.hostId !== userOf(req)) {
    res.status(404).json({ error: 'Examen introuvable.' });
    return null;
  }
  return s;
}

examRouter.post('/exams/:code/start', hostOnly, async (req, res) => {
  const s = await myExam(req, res);
  if (!s) return;
  if (s.status !== 'LOBBY') {
    res.status(409).json({ error: 'L’examen a déjà commencé.' });
    return;
  }
  const now = new Date();
  await prisma.examSession.update({ where: { id: s.id }, data: { status: 'RUNNING', startedAt: now } });
  scheduleEnd(s.joinCode, endsAtOf(now, s.durationMin)!);
  broadcast(s.joinCode);
  res.json({ ok: true });
});

examRouter.post('/exams/:code/finish', hostOnly, async (req, res) => {
  const s = await myExam(req, res);
  if (!s) return;
  if (s.status === 'FINISHED') {
    res.json({ ok: true });
    return;
  }
  clearTimeout(timers.get(s.joinCode));
  await prisma.examSession.update({ where: { id: s.id }, data: { status: 'FINISHED', finishedAt: new Date(), startedAt: s.startedAt ?? new Date() } });
  broadcast(s.joinCode);
  res.json({ ok: true });
});

/** Décision de l'enseignant sur un étudiant : le débloquer, ou clore sa copie. */
async function decide(req: Request, res: Response, decision: 'unlock' | 'exclude') {
  const s = await myExam(req, res);
  if (!s) return;
  const userId = Number(req.params.userId);
  const seat = Number.isInteger(userId) ? await prisma.examParticipant.findUnique({ where: { examId_userId: { examId: s.id, userId } } }) : null;
  if (!seat) {
    res.status(404).json({ error: 'Étudiant introuvable dans cet examen.' });
    return;
  }
  const next = applyDecision(seat, decision);
  if (next.changed) {
    // Mise à jour conditionnelle : si l'étudiant a changé d'état entre-temps (copie rendue…), on ne l'écrase pas.
    const done = await prisma.examParticipant.updateMany({
      where: { examId: s.id, userId, status: seat.status },
      data: { status: next.seat.status, lockedAt: next.seat.lockedAt, lockReason: next.seat.lockReason },
    });
    if (done.count) await log(s.id, userId, decision === 'unlock' ? 'UNLOCK' : 'EXCLUDE');
    broadcast(s.joinCode);
  }
  res.json({ ok: true, status: next.seat.status });
}
examRouter.post('/exams/:code/seats/:userId/unlock', hostOnly, (req, res) => decide(req, res, 'unlock'));
examRouter.post('/exams/:code/seats/:userId/exclude', hostOnly, (req, res) => decide(req, res, 'exclude'));

/** Copie d'un étudiant (pour la correction ou en cas de contestation). */
examRouter.get('/exams/:code/seats/:userId', hostOnly, async (req, res) => {
  const s = await myExam(req, res);
  if (!s) return;
  const userId = Number(req.params.userId);
  const answers = await prisma.examAnswer.findMany({ where: { examId: s.id, userId }, include: { challenge: { select: { title: true } } } });
  res.json({ items: answers.map((a) => ({ challengeId: a.challengeId, title: a.challenge.title, answer: a.answer, correct: a.correct, at: a.updatedAt })) });
});

// ───────────── Étudiants ─────────────

examRouter.post('/exams/join', studentOnly, async (req, res) => {
  const code = normalizeCode(req.body?.code);
  const s = code ? await prisma.examSession.findUnique({ where: { joinCode: code } }) : null;
  if (!s || s.status === 'FINISHED' || isOverdue(s.status, s.startedAt, s.durationMin, Date.now())) {
    res.status(404).json({ error: 'Aucun examen ouvert avec ce code.' });
    return;
  }
  const userId = userOf(req);
  // Rejoindre à nouveau (après un rechargement) ne remet pas à zéro un blocage.
  const existing = await prisma.examParticipant.findUnique({ where: { examId_userId: { examId: s.id, userId } } });
  if (!existing) {
    await prisma.examParticipant.create({ data: { examId: s.id, userId } });
    await log(s.id, userId, 'JOIN');
    broadcast(s.joinCode);
  }
  res.json({ code: s.joinCode });
});

async function mySeat(req: Request, res: Response) {
  const s = await prisma.examSession.findUnique({ where: { joinCode: normalizeCode(req.params.code) }, include: { challenges: { include: { challenge: true } } } });
  const seat = s && (await prisma.examParticipant.findUnique({ where: { examId_userId: { examId: s.id, userId: userOf(req) } } }));
  if (!s || !seat) {
    res.status(403).json({ error: 'Entre d’abord le code de l’examen.' });
    return null;
  }
  return { s, seat };
}

/** Le navigateur signale que l'étudiant a quitté la page : sa copie est bloquée. */
examRouter.post('/exams/:code/leave', studentOnly, async (req, res) => {
  const found = await mySeat(req, res);
  if (!found) return;
  const { s, seat } = found;
  if (s.status !== 'RUNNING') {
    res.json({ status: seat.status });
    return;
  }
  const reason = leaveReason(req.body?.reason);
  const next = applyLeave(seat, reason, new Date());
  if (next.changed) {
    const done = await prisma.examParticipant.updateMany({
      where: { examId: s.id, userId: seat.userId, status: 'ACTIVE' },
      data: { status: 'LOCKED', leaveCount: { increment: 1 }, lockedAt: next.seat.lockedAt, lockReason: reason },
    });
    if (done.count) await log(s.id, seat.userId, 'LEAVE', reason);
    broadcast(s.joinCode);
  }
  res.json({ status: next.seat.status });
});

/** Vérifie que l'étudiant peut travailler sur ce défi, ou répond à sa place. */
function workable(found: NonNullable<Awaited<ReturnType<typeof mySeat>>>, req: Request, res: Response) {
  const { s, seat } = found;
  if (!canWork(s.status, seat.status, s.startedAt, s.durationMin, Date.now(), GRACE_MS)) {
    const why =
      seat.status === 'LOCKED'
        ? 'Ta copie est bloquée : attends que l’enseignant la débloque.'
        : seat.status === 'EXCLUDED'
          ? 'L’enseignant a clos ta copie.'
          : seat.status === 'SUBMITTED'
            ? 'Tu as déjà rendu ta copie.'
            : s.status === 'LOBBY'
              ? 'L’examen n’a pas encore commencé.'
              : 'L’examen est terminé.';
    res.status(423).json({ error: why, status: seat.status });
    return null;
  }
  const challengeId = Number(req.body?.challengeId);
  const c = s.challenges.find((x) => x.challengeId === challengeId)?.challenge;
  if (!c || !c.setupSql || !c.solutionSql) {
    res.status(404).json({ error: 'Ce défi ne fait pas partie de l’examen.' });
    return null;
  }
  return { ...found, c: c as typeof c & { setupSql: string; solutionSql: string } };
}

const lastRun = new Map<string, number>();

examRouter.post('/exams/:code/run', studentOnly, async (req, res) => {
  const found = await mySeat(req, res);
  const ok = found && workable(found, req, res);
  if (!ok) return;
  const key = `${ok.s.id}:${ok.seat.userId}`;
  if (Date.now() - (lastRun.get(key) ?? 0) < MIN_GAP_MS) {
    res.status(429).json({ error: 'Doucement : une exécution à la fois.' });
    return;
  }
  lastRun.set(key, Date.now());
  res.json(runQuery(ok.c.setupSql, String(req.body?.query ?? '').slice(0, 4000)));
});

/** Enregistre (et corrige en silence) la réponse de l'étudiant pour un défi ; il peut la modifier jusqu'à la fin. */
examRouter.post('/exams/:code/answer', studentOnly, async (req, res) => {
  const found = await mySeat(req, res);
  const ok = found && workable(found, req, res);
  if (!ok) return;
  const answer = String(req.body?.query ?? '').trim().slice(0, 4000);
  if (!answer) {
    res.status(400).json({ error: 'La requête est vide.' });
    return;
  }
  const verdict = judge(ok.c.setupSql, ok.c.solutionSql, answer);
  const correct = !('error' in verdict) && verdict.passed;
  const key = { examId: ok.s.id, userId: ok.seat.userId, challengeId: ok.c.id };
  await prisma.examAnswer.upsert({ where: { examId_userId_challengeId: key }, update: { answer, correct }, create: { ...key, answer, correct } });
  broadcast(ok.s.joinCode);
  res.json({ ok: true, savedAt: new Date() });
});

examRouter.post('/exams/:code/submit', studentOnly, async (req, res) => {
  const found = await mySeat(req, res);
  if (!found) return;
  const { s, seat } = found;
  if (seat.status !== 'ACTIVE' || s.status !== 'RUNNING') {
    res.status(409).json({ error: 'Tu ne peux pas rendre ta copie maintenant.' });
    return;
  }
  const done = await prisma.examParticipant.updateMany({ where: { examId: s.id, userId: seat.userId, status: 'ACTIVE' }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
  if (done.count) await log(s.id, seat.userId, 'SUBMIT');
  broadcast(s.joinCode);
  res.json({ ok: true });
});

// ───────────── Flux en direct ─────────────

examRouter.get('/exams/:code/stream', requireAuth(), async (req, res) => {
  const userId = userOf(req);
  const core = await load(normalizeCode(req.params.code));
  if (!core) {
    res.status(404).json({ error: 'Examen introuvable.' });
    return;
  }
  const host = core.s.hostId === userId;
  if (!host && !core.s.participants.some((p) => p.userId === userId)) {
    res.status(403).json({ error: 'Entre d’abord le code de l’examen.' });
    return;
  }

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const sub: Sub = { res, userId, host };
  const code = core.s.joinCode;
  const set = subs.get(code) ?? new Set<Sub>();
  set.add(sub);
  subs.set(code, set);

  res.write(`data: ${JSON.stringify(view(core, sub))}\n\n`);
  if (!host) broadcast(code); // l'enseignant voit l'étudiant passer « en ligne »
  const beat = setInterval(() => res.write(': ping\n\n'), 10_000);
  req.on('close', () => {
    clearInterval(beat);
    set.delete(sub);
    if (!set.size) subs.delete(code);
    else if (!host) broadcast(code);
  });
});
