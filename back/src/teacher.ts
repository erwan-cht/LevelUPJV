// Espace enseignant : suivi des promos, devoirs assignés, création de défis, compétences.
import { Router, type Request } from 'express';
import { requireAuth } from './auth.js';
import { prisma } from './db.js';
import {
  difficultyFromLabel,
  groupShort,
  initials,
  subjectFromLabel,
  subjectLabel,
  typeForSubject,
} from './format.js';
import { runQuery } from './sql.js';
import { competenceLevels } from './services.js';

export const teacherRouter = Router();
teacherRouter.use(requireAuth('TEACHER'));

const DAY = 86_400_000;
const ID = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Promotions et groupes proposés dans les listes déroulantes. */
async function loadFilters() {
  const [promotions, groups] = await Promise.all([
    prisma.promotion.findMany({ orderBy: { id: 'asc' } }),
    prisma.group.findMany({ orderBy: { name: 'asc' } }),
  ]);
  return {
    promotions,
    groups,
    list: promotions.map((p) => ({
      id: p.id,
      name: p.name,
      groups: groups.filter((g) => g.promo === p.code).map((g) => ({ id: g.id, name: groupShort(g.name) })),
    })),
  };
}

/** Promotion (et groupe) choisis dans la requête ; par défaut, la promotion dont l'enseignant est référent. */
async function scopeOf(req: Request) {
  const f = await loadFilters();
  const asked = ID(req.query.promoId);
  const promo =
    f.promotions.find((p) => p.id === asked) ??
    f.promotions.find((p) => p.referentId === req.auth!.sub) ??
    f.promotions[0] ??
    null;
  const askedGroup = ID(req.query.groupId);
  const group = promo ? f.groups.find((g) => g.id === askedGroup && g.promo === promo.code) ?? null : null;
  const students = promo
    ? await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE', group: { promo: promo.code }, ...(group ? { groupId: group.id } : {}) },
        select: { id: true, firstName: true, lastName: true, createdAt: true },
      })
    : [];
  return { filters: f, promo, group, students };
}

const trend = (diff: number, suffix: string) => `${diff > 0 ? '▲ +' : diff < 0 ? '▼ ' : '= '}${diff}${suffix}`;
const tone = (diff: number, goodWhenUp = true) =>
  diff === 0 ? 'flat' : diff > 0 === goodWhenUp ? 'good' : 'bad';

// ───────────── Tableau de bord ─────────────

teacherRouter.get('/overview', async (req, res) => {
  const { filters, promo, group, students } = await scopeOf(req);
  const days = [7, 30, 180].includes(Number(req.query.period)) ? Number(req.query.period) : 7;
  const ids = students.map((s) => s.id);
  const now = Date.now();
  const since = now - days * DAY;
  const prevSince = now - 2 * days * DAY;

  const [attempts, gains, lastGains, competences, challenges] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId: { in: ids }, duelId: null },
      select: { userId: true, challengeId: true, status: true, createdAt: true, challenge: { select: { title: true, subject: true } } },
    }),
    // Toute activité compte (défi tenté, points gagnés), pas seulement les tentatives.
    prisma.pointEvent.findMany({
      where: { userId: { in: ids }, points: { gt: 0 }, createdAt: { gte: new Date(prevSince) } },
      select: { userId: true, createdAt: true },
    }),
    prisma.pointEvent.groupBy({ by: ['userId'], where: { userId: { in: ids }, points: { gt: 0 } }, _max: { createdAt: true } }),
    competenceLevels(ids),
    prisma.challenge.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { id: 'asc' },
      select: { id: true, title: true, subject: true },
    }),
  ]);

  const inRange = (from: number, to: number) => attempts.filter((a) => a.createdAt.getTime() >= from && a.createdAt.getTime() < to);
  const cur = inRange(since, now + 1);
  const prev = inRange(prevSince, since);

  const activeIn = (from: number, to: number) =>
    new Set([...inRange(from, to).map((a) => a.userId), ...gains.filter((g) => g.createdAt.getTime() >= from && g.createdAt.getTime() < to).map((g) => g.userId)]);

  const summarize = (list: typeof attempts, active: Set<number>) => {
    const passed = new Set(list.filter((a) => a.status === 'PASSED').map((a) => `${a.userId}|${a.challengeId}`));
    return {
      active: active.size,
      passes: passed.size,
      rate: list.length === 0 ? 0 : Math.round((list.filter((a) => a.status === 'PASSED').length / list.length) * 100),
    };
  };
  const c = summarize(cur, activeIn(since, now + 1));
  const p = summarize(prev, activeIn(prevSince, since));

  // Notions : réussite par défi sur la période
  const byChallenge = new Map<number, { title: string; subject: string; tried: Set<number>; passed: Set<number>; attempts: number }>();
  for (const a of cur) {
    const row = byChallenge.get(a.challengeId) ?? { title: a.challenge.title, subject: a.challenge.subject, tried: new Set(), passed: new Set(), attempts: 0 };
    row.tried.add(a.userId);
    if (a.status === 'PASSED') row.passed.add(a.userId);
    row.attempts++;
    byChallenge.set(a.challengeId, row);
  }
  const notions = [...byChallenge.entries()]
    .map(([id, r]) => ({
      id,
      title: r.title,
      subject: subjectLabel[r.subject],
      successRate: Math.round((r.passed.size / r.tried.size) * 100),
      attempts: Math.round((r.attempts / r.tried.size) * 10) / 10,
    }))
    .sort((a, b) => a.successRate - b.successRate || b.attempts - a.attempts)
    .slice(0, 12);

  // Étudiants à accompagner : dernière activité connue (tentative ou gain de points)
  const recent = new Map<number, number>();
  for (const g of lastGains) recent.set(g.userId, g._max.createdAt?.getTime() ?? 0);
  const flagged = students
    .map((s) => {
      const mine = attempts.filter((a) => a.userId === s.id);
      const last = Math.max(
        mine.reduce((m, a) => Math.max(m, a.createdAt.getTime()), 0),
        recent.get(s.id) ?? 0,
      );
      const idle = Math.floor((now - (last || s.createdAt.getTime())) / DAY);
      const entry = { name: `${s.firstName} ${s.lastName}`, initials: initials(s.firstName, s.lastName) };

      if (idle >= 7) {
        return { ...entry, tag: 'inactif' as const, score: 100 + idle, info: last ? `Aucune activité depuis ${idle} jours` : `Aucune activité depuis l’inscription (${idle} jours)` };
      }
      for (const subject of Object.keys(subjectLabel)) {
        const inSubject = mine.filter((a) => a.challenge.subject === subject);
        const rate = inSubject.length === 0 ? 100 : (inSubject.filter((a) => a.status === 'PASSED').length / inSubject.length) * 100;
        if (inSubject.length >= 3 && rate < 30) {
          return { ...entry, tag: 'bloqué' as const, score: 90 - rate, info: `${Math.round(rate)} % de réussite en ${subjectLabel[subject].toLowerCase()}` };
        }
      }
      const stuck = new Map<number, { title: string; n: number; passed: boolean }>();
      for (const a of mine) {
        const row = stuck.get(a.challengeId) ?? { title: a.challenge.title, n: 0, passed: false };
        row.n++;
        row.passed ||= a.status === 'PASSED';
        stuck.set(a.challengeId, row);
      }
      const worst = [...stuck.values()].filter((r) => !r.passed && r.n >= 4).sort((a, b) => b.n - a.n)[0];
      if (worst) return { ...entry, tag: 'à suivre' as const, score: worst.n, info: `${worst.n} tentatives sur ${worst.title}` };
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  const blocking = notions.filter((n) => n.successRate < 45).slice(0, 2);

  res.json({
    filters: filters.list,
    selected: { promoId: promo?.id ?? null, groupId: group?.id ?? null, period: days },
    students: students.length,
    stats: [
      { label: 'Étudiants actifs', value: String(c.active), suffix: `/ ${students.length}`, trend: `${trend(c.active - p.active, '')} vs période précédente`, tone: tone(c.active - p.active) },
      {
        label: 'Défis réussis',
        value: c.passes.toLocaleString('fr-FR'),
        suffix: '',
        trend: p.passes === 0 ? (c.passes > 0 ? '▲ nouveau' : '= aucun') : `${trend(Math.round(((c.passes - p.passes) / p.passes) * 100), ' %')}`,
        tone: tone(c.passes - p.passes),
      },
      { label: 'Taux de réussite moyen', value: String(c.rate), suffix: '%', trend: `${trend(c.rate - p.rate, ' pts')}`, tone: tone(c.rate - p.rate) },
      { label: 'Étudiants en difficulté', value: String(flagged.length), suffix: '', trend: flagged.length > 0 ? 'à accompagner' : 'aucun pour le moment', tone: flagged.length > 0 ? 'bad' : 'good' },
    ],
    notions,
    toHelp: { items: flagged.slice(0, 4).map(({ score: _score, ...rest }) => rest), total: flagged.length },
    alert:
      blocking.length > 0
        ? `${blocking.length > 1 ? 'Les notions' : 'La notion'} ${blocking.map((b) => b.title).join(' et ')} ${blocking.length > 1 ? 'bloquent' : 'bloque'} la promo : pense à relancer un challenge en TD.`
        : notions.length > 0
          ? 'Aucune notion ne bloque la promo sur cette période.'
          : 'Pas encore d’activité sur cette période.',
    competences: competences.map((x) => ({ name: x.name, description: x.description, value: x.value })),
    challenges: challenges.map((x) => ({ id: x.id, title: x.title, subject: subjectLabel[x.subject] })),
  });
});

// ───────────── Compétences de la promo ─────────────

teacherRouter.get('/competences', async (req, res) => {
  const { filters, promo, group, students } = await scopeOf(req);
  const items = await competenceLevels(students.map((s) => s.id));
  res.json({
    promotion: promo?.name ?? null,
    group: group ? groupShort(group.name) : null,
    filters: filters.list,
    selected: { promoId: promo?.id ?? null, groupId: group?.id ?? null },
    items: items.map((c) => ({ name: c.name, description: c.description, value: c.value, skills: c.skills })),
  });
});

// ───────────── Devoirs (« Lancer un challenge en TD ») ─────────────

teacherRouter.post('/assignments', async (req, res) => {
  const challengeId = ID(req.body?.challengeId);
  const groupId = ID(req.body?.groupId);
  const promoId = ID(req.body?.promoId);
  const durationMin = Math.min(180, Math.max(5, Number(req.body?.durationMin) || 30));

  const challenge = challengeId ? await prisma.challenge.findFirst({ where: { id: challengeId, status: 'PUBLISHED' } }) : null;
  if (!challenge) {
    res.status(404).json({ error: 'Défi introuvable ou non publié.' });
    return;
  }
  const group = groupId ? await prisma.group.findUnique({ where: { id: groupId } }) : null;
  const promo = !group && promoId ? await prisma.promotion.findUnique({ where: { id: promoId } }) : null;
  if (!group && !promo) {
    res.status(400).json({ error: 'Choisis un groupe ou une promotion.' });
    return;
  }

  await prisma.assignment.create({
    data: {
      challengeId: challenge.id,
      createdById: req.auth!.sub,
      durationMin,
      ...(group ? { groupId: group.id } : { promoCode: promo!.code }),
    },
  });
  res.status(201).json({ target: group ? group.name : promo!.name, title: challenge.title });
});

// ───────────── Création de défi ─────────────

/** Données utiles au formulaire : groupes, compétences, et compétence habituelle de chaque matière. */
teacherRouter.get('/options', async (req, res) => {
  const [filters, competences, links] = await Promise.all([
    loadFilters(),
    prisma.competence.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true } }),
    prisma.challengeCompetence.findMany({ select: { competenceId: true, challenge: { select: { subject: true } } } }),
  ]);

  const count = new Map<string, Map<number, number>>();
  for (const l of links) {
    const m = count.get(l.challenge.subject) ?? new Map<number, number>();
    m.set(l.competenceId, (m.get(l.competenceId) ?? 0) + 1);
    count.set(l.challenge.subject, m);
  }
  const suggested: Record<string, number | null> = {};
  for (const [subject, label] of Object.entries(subjectLabel)) {
    const best = [...(count.get(subject) ?? new Map()).entries()].sort((a, b) => b[1] - a[1])[0];
    suggested[label] = best ? best[0] : null;
  }

  // La promotion dont l'enseignant est référent passe en premier.
  const mine = filters.promotions.find((p) => p.referentId === req.auth!.sub)?.id;
  const promotions = [...filters.list].sort((a, b) => Number(b.id === mine) - Number(a.id === mine));
  res.json({ promotions, competences, suggested });
});

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

teacherRouter.post('/challenges', async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const title = String(b.title ?? '').trim();
  const statement = String(b.statement ?? '').trim();
  const constraint = String(b.constraint ?? '').trim();
  const subject = subjectFromLabel[String(b.subject ?? '')];
  const difficulty = difficultyFromLabel[String(b.difficulty ?? '')];
  const kind = b.kind === 'tests' ? 'tests' : 'sql';
  const publish = b.status === 'PUBLISHED';
  const points = num(b.points, 0);
  const minutes = num(b.minutes, 20);
  const setupSql = String(b.setupSql ?? '').trim();
  const reference = String(b.reference ?? '').trim();

  const fail = (error: string) => res.status(400).json({ error });
  if (!title || title.length > 80) return fail('Le titre est obligatoire (80 caractères maximum).');
  if (!subject || !difficulty) return fail('Matière ou difficulté invalide.');
  if (publish && statement.length < 40) return fail('L’énoncé doit faire au moins 40 caractères pour être publié.');
  if (points < 10 || points > 200) return fail('Les points doivent être compris entre 10 et 200.');
  if (minutes < 5 || minutes > 120) return fail('La durée estimée doit être comprise entre 5 et 120 minutes.');

  // Un défi SQL doit pouvoir être corrigé : on exécute la requête de référence sur le jeu de données.
  if (kind === 'sql' && (publish || reference || setupSql)) {
    if (!setupSql) return fail('Ajoute le jeu de données (CREATE TABLE / INSERT) du défi.');
    if (!reference) return fail('Ajoute la requête de référence.');
    const check = runQuery(setupSql, reference);
    if (check.error) return fail(`La requête de référence ne s’exécute pas : ${check.error}`);
    if (check.columns.length === 0) return fail('La requête de référence ne renvoie aucune colonne.');
  }
  if (kind === 'tests' && publish) {
    // Les défis « code » sont enregistrés, mais leur correction automatique n'existe pas encore.
    if (!reference) return fail('Ajoute la solution de référence.');
  }

  const competenceId = ID(b.competenceId);
  const competence = competenceId ? await prisma.competence.findUnique({ where: { id: competenceId } }) : null;

  const raw = (b.settings ?? {}) as Record<string, unknown>;
  const hints = (raw.hints ?? {}) as Record<string, unknown>;
  const settings = {
    orderMatters: bool(raw.orderMatters, false),
    maxAttempts: raw.maxAttempts === null ? null : Math.min(50, Math.max(1, num(raw.maxAttempts, 5))),
    variant: bool(raw.variant, false),
    similarity: bool(raw.similarity, false),
    threshold: num(raw.threshold, 85),
    maxTime: String(raw.maxTime ?? '5 s'),
    maxMemory: String(raw.maxMemory ?? '128 Mo'),
    hints: { enabled: bool(hints.enabled, true), count: num(hints.count, 3), advice: String(hints.advice ?? '').slice(0, 1000) },
  };

  const challenge = await prisma.challenge.create({
    data: {
      title,
      statement: constraint ? `${statement}\n\n**Contrainte :** ${constraint}` : statement,
      type: kind === 'sql' ? 'SQL' : typeForSubject[subject],
      subject,
      difficulty,
      minutes,
      basePoints: points,
      status: publish ? 'PUBLISHED' : 'DRAFT',
      authorId: req.auth!.sub,
      setupSql: kind === 'sql' ? setupSql || null : null,
      solutionSql: reference || null,
      starterCode: kind === 'sql' ? 'SELECT ' : null,
      settings,
      ...(competence ? { competences: { create: { competenceId: competence.id } } } : {}),
    },
  });

  // « Publier pour » : le défi apparaît comme recommandé chez le groupe ou la promo choisis.
  let target: string | null = null;
  if (publish) {
    const group = ID(b.groupId) ? await prisma.group.findUnique({ where: { id: ID(b.groupId)! } }) : null;
    const promo = !group && ID(b.promoId) ? await prisma.promotion.findUnique({ where: { id: ID(b.promoId)! } }) : null;
    if (group || promo) {
      await prisma.assignment.create({
        data: { challengeId: challenge.id, createdById: req.auth!.sub, ...(group ? { groupId: group.id } : { promoCode: promo!.code }) },
      });
      target = group ? group.name : promo!.name;
    }
  }

  res.status(201).json({ id: challenge.id, status: challenge.status, target });
});
