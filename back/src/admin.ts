// Espace administrateur : comptes, promotions et groupes, modération des défis, référentiel de compétences.
// Chaque modification est inscrite dans le journal d'administration (AuditLog).
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { requireAuth } from './auth.js';
import { prisma } from './db.js';
import {
  contentFromFront,
  contentToFront,
  difficultyLabel,
  fullName,
  groupShort,
  initials,
  promoCodeOf,
  randomPassword,
  roleFromFront,
  roleLabel,
  shortDescription,
  slugify,
  statusFromFront,
  statusToFront,
  subjectLabel,
} from './format.js';
import { competenceLevels } from './services.js';

export const adminRouter = Router();
adminRouter.use(requireAuth('ADMIN'));

const ID = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const IDS = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(ID).filter((n): n is number => n !== null))] : []);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_GROUP = 'Sans groupe';

const log = (actorId: number, text: string) => prisma.auditLog.create({ data: { actorId, text } });

const hash = (password: string) => bcrypt.hash(password, 10);

// ───────────── Comptes ─────────────

type AccountRow = Awaited<ReturnType<typeof loadAccounts>>[number];

const loadAccounts = () =>
  prisma.user.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { group: true } });

const accountOut = (u: AccountRow) => ({
  id: u.id,
  name: fullName(u),
  initials: initials(u.firstName, u.lastName),
  email: u.email,
  role: roleLabel[u.role],
  status: statusToFront[u.status],
  promo: u.role === 'STUDENT' ? (u.group?.name ?? NO_GROUP) : u.role === 'TEACHER' ? u.teaches || '—' : '—',
  lastLogin: u.lastLoginAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
});

adminRouter.get('/accounts', async (_req, res) => {
  res.json((await loadAccounts()).map(accountOut));
});

interface AccountDraft {
  firstName: string;
  lastName: string;
  email: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  groupId: number | null;
  teaches: string;
}

/** Valide le formulaire de compte ; renvoie le brouillon ou un message d'erreur. */
async function parseAccount(body: Record<string, unknown>, selfId?: number): Promise<AccountDraft | { error: string }> {
  const tokens = String(body.name ?? '').trim().split(/\s+/).filter(Boolean);
  const email = String(body.email ?? '').trim().toLowerCase();
  const role = roleFromFront[String(body.role ?? '')];
  const status = statusFromFront[String(body.status ?? 'en-attente')];
  const promo = String(body.promo ?? '').trim();

  if (tokens.length < 2) return { error: 'Indique le prénom et le nom.' };
  if (!EMAIL_RE.test(email)) return { error: 'Adresse e-mail invalide.' };
  if (!role || !status) return { error: 'Rôle ou statut invalide.' };

  const taken = await prisma.user.findFirst({ where: { email, ...(selfId ? { id: { not: selfId } } : {}) } });
  if (taken) return { error: 'Cette adresse est déjà utilisée par un autre compte.' };

  let groupId: number | null = null;
  if (role === 'STUDENT' && promo && promo !== NO_GROUP) {
    const group = await prisma.group.findFirst({ where: { name: promo } });
    if (!group) return { error: `Le groupe « ${promo} » n’existe pas.` };
    groupId = group.id;
  }
  return {
    firstName: tokens[0],
    lastName: tokens.slice(1).join(' '),
    email,
    role,
    status,
    groupId,
    teaches: role === 'TEACHER' && promo !== '—' ? promo : '',
  };
}

/** Pseudo unique, construit à partir du nom (ex. « alicev », « alicev2 »). */
async function freePseudo(firstName: string, lastName: string) {
  const base = `${slugify(firstName)}${slugify(lastName).slice(0, 1)}` || 'user';
  for (let i = 0; i < 100; i++) {
    const pseudo = i === 0 ? base : `${base}${i + 1}`;
    if (!(await prisma.user.findUnique({ where: { pseudo } }))) return pseudo;
  }
  return `${base}${Date.now()}`;
}

adminRouter.post('/accounts', async (req, res) => {
  const draft = await parseAccount(req.body ?? {});
  if ('error' in draft) {
    res.status(400).json({ error: draft.error });
    return;
  }
  // Pas d'e-mail d'invitation pour l'instant : on génère un mot de passe provisoire, montré une seule fois.
  const temporaryPassword = randomPassword();
  const user = await prisma.user.create({
    data: {
      ...draft,
      pseudo: await freePseudo(draft.firstName, draft.lastName),
      passwordHash: await hash(temporaryPassword),
    },
    include: { group: true },
  });
  await log(req.auth!.sub, `Compte de ${fullName(user)} créé (${roleLabel[user.role]})`);
  res.status(201).json({ account: accountOut(user), temporaryPassword });
});

adminRouter.patch('/accounts/:id', async (req, res) => {
  const id = ID(req.params.id);
  const me = req.auth!.sub;
  const before = id ? await prisma.user.findUnique({ where: { id } }) : null;
  if (!before) {
    res.status(404).json({ error: 'Compte introuvable.' });
    return;
  }
  const draft = await parseAccount(req.body ?? {}, before.id);
  if ('error' in draft) {
    res.status(400).json({ error: draft.error });
    return;
  }
  if (before.id === me && (draft.role !== 'ADMIN' || draft.status !== 'ACTIVE')) {
    res.status(400).json({ error: 'Tu ne peux pas retirer ton propre accès administrateur.' });
    return;
  }

  const user = await prisma.user.update({ where: { id: before.id }, data: draft, include: { group: true } });
  await log(
    me,
    before.role !== user.role
      ? `Rôle de ${fullName(user)} : ${roleLabel[before.role]} → ${roleLabel[user.role]}`
      : `Compte de ${fullName(user)} modifié`,
  );
  res.json(accountOut(user));
});

adminRouter.post('/accounts/status', async (req, res) => {
  const ids = IDS(req.body?.ids);
  const status = statusFromFront[String(req.body?.status ?? '')];
  if (ids.length === 0 || !status) {
    res.status(400).json({ error: 'Sélection ou statut invalide.' });
    return;
  }
  if (status !== 'ACTIVE' && ids.includes(req.auth!.sub)) {
    res.status(400).json({ error: 'Tu ne peux pas suspendre ton propre compte.' });
    return;
  }
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  await prisma.user.updateMany({ where: { id: { in: users.map((u) => u.id) } }, data: { status } });

  const verb = status === 'SUSPENDED' ? 'suspendu' : status === 'ACTIVE' ? 'activé' : 'mis en attente';
  await log(
    req.auth!.sub,
    users.length === 1 ? `Compte de ${fullName(users[0])} ${verb}` : `${users.length} comptes ${verb}s`,
  );
  res.json({ updated: users.length });
});

adminRouter.post('/accounts/delete', async (req, res) => {
  const ids = IDS(req.body?.ids);
  if (ids.length === 0) {
    res.status(400).json({ error: 'Aucun compte sélectionné.' });
    return;
  }
  if (ids.includes(req.auth!.sub)) {
    res.status(400).json({ error: 'Tu ne peux pas supprimer ton propre compte.' });
    return;
  }
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  // L'historique du compte (tentatives, points, badges, duels) est supprimé avec lui.
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await log(
    req.auth!.sub,
    users.length === 1 ? `Compte de ${fullName(users[0])} supprimé` : `${users.length} comptes supprimés`,
  );
  res.json({ deleted: users.length });
});

adminRouter.post('/accounts/reset-password', async (req, res) => {
  const ids = IDS(req.body?.ids);
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } } }) : [];
  if (users.length === 0) {
    res.status(400).json({ error: 'Aucun compte sélectionné.' });
    return;
  }
  const out: { id: number; name: string; email: string; temporaryPassword: string }[] = [];
  for (const u of users) {
    const temporaryPassword = randomPassword();
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hash(temporaryPassword) } });
    out.push({ id: u.id, name: fullName(u), email: u.email, temporaryPassword });
  }
  await log(
    req.auth!.sub,
    users.length === 1 ? `Mot de passe de ${fullName(users[0])} réinitialisé` : `Mots de passe de ${users.length} comptes réinitialisés`,
  );
  res.json(out);
});

// ───────────── Promotions et groupes ─────────────

async function loadPromotions() {
  const [promotions, groups] = await Promise.all([
    prisma.promotion.findMany({ orderBy: { id: 'asc' }, include: { referent: true } }),
    prisma.group.findMany({ orderBy: { name: 'asc' } }),
  ]);
  return promotions.map((p) => ({
    id: p.id,
    name: p.name,
    year: p.year,
    referent: p.referent ? fullName(p.referent) : '',
    groups: groups.filter((g) => g.promo === p.code).map((g) => groupShort(g.name)),
  }));
}

const teacherByName = async (name: string) => {
  if (!name) return null;
  const teachers = await prisma.user.findMany({ where: { role: 'TEACHER' } });
  return teachers.find((t) => fullName(t) === name) ?? null;
};

adminRouter.get('/promotions', async (_req, res) => {
  res.json(await loadPromotions());
});

adminRouter.post('/promotions', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const year = String(req.body?.year ?? '2026-2027').trim();
  const count = Math.min(8, Math.max(1, Number(req.body?.groups) || 1));
  if (!name) {
    res.status(400).json({ error: 'Donne un nom à la promotion.' });
    return;
  }
  const code = promoCodeOf(name);
  const exists = await prisma.promotion.findFirst({ where: { OR: [{ name }, { code }] } });
  if (exists) {
    res.status(409).json({ error: 'Une promotion porte déjà ce nom.' });
    return;
  }
  const referent = await teacherByName(String(req.body?.referent ?? ''));

  await prisma.$transaction(async (tx) => {
    await tx.promotion.create({ data: { name, code, year, referentId: referent?.id ?? null } });
    await tx.group.createMany({
      data: Array.from({ length: count }, (_, i) => ({ name: `${code} · Groupe ${i + 1}`, promo: code, teacherId: referent?.id ?? null })),
    });
  });
  await log(req.auth!.sub, `Promotion ${name} créée (${count} groupe${count > 1 ? 's' : ''})`);
  res.status(201).json(await loadPromotions());
});

adminRouter.post('/promotions/:id/groups', async (req, res) => {
  const id = ID(req.params.id);
  const promo = id ? await prisma.promotion.findUnique({ where: { id } }) : null;
  if (!promo) {
    res.status(404).json({ error: 'Promotion introuvable.' });
    return;
  }
  const existing = new Set((await prisma.group.findMany({ where: { promo: promo.code } })).map((g) => groupShort(g.name)));
  let i = 1;
  while (existing.has(`Groupe ${i}`)) i++;
  await prisma.group.create({ data: { name: `${promo.code} · Groupe ${i}`, promo: promo.code, teacherId: promo.referentId } });
  await log(req.auth!.sub, `Groupe ${i} ajouté à ${promo.name}`);
  res.status(201).json(await loadPromotions());
});

adminRouter.patch('/promotions/:id', async (req, res) => {
  const id = ID(req.params.id);
  const promo = id ? await prisma.promotion.findUnique({ where: { id } }) : null;
  if (!promo) {
    res.status(404).json({ error: 'Promotion introuvable.' });
    return;
  }
  const referent = await teacherByName(String(req.body?.referent ?? ''));
  if (!referent) {
    res.status(400).json({ error: 'Enseignant introuvable.' });
    return;
  }
  await prisma.$transaction([
    prisma.promotion.update({ where: { id: promo.id }, data: { referentId: referent.id } }),
    prisma.group.updateMany({ where: { promo: promo.code }, data: { teacherId: referent.id } }),
  ]);
  await log(req.auth!.sub, `Référent de ${promo.name} : ${fullName(referent)}`);
  res.json(await loadPromotions());
});

adminRouter.delete('/promotions/:id/groups/:name', async (req, res) => {
  const id = ID(req.params.id);
  const promo = id ? await prisma.promotion.findUnique({ where: { id } }) : null;
  const short = String(req.params.name);
  const group = promo ? await prisma.group.findFirst({ where: { promo: promo.code, name: `${promo.code} · ${short}` } }) : null;
  if (!promo || !group) {
    res.status(404).json({ error: 'Groupe introuvable.' });
    return;
  }
  // Les étudiants du groupe passent « Sans groupe » (leur compte n'est pas supprimé).
  await prisma.$transaction([
    prisma.assignment.deleteMany({ where: { groupId: group.id } }),
    prisma.group.delete({ where: { id: group.id } }),
  ]);
  await log(req.auth!.sub, `${short} supprimé de ${promo.name}`);
  res.json(await loadPromotions());
});

adminRouter.delete('/promotions/:id', async (req, res) => {
  const id = ID(req.params.id);
  const promo = id ? await prisma.promotion.findUnique({ where: { id } }) : null;
  if (!promo) {
    res.status(404).json({ error: 'Promotion introuvable.' });
    return;
  }
  const groups = await prisma.group.findMany({ where: { promo: promo.code }, select: { id: true } });
  await prisma.$transaction([
    prisma.assignment.deleteMany({ where: { OR: [{ promoCode: promo.code }, { groupId: { in: groups.map((g) => g.id) } }] } }),
    prisma.group.deleteMany({ where: { promo: promo.code } }),
    prisma.promotion.delete({ where: { id: promo.id } }),
  ]);
  await log(req.auth!.sub, `Promotion ${promo.name} supprimée`);
  res.json(await loadPromotions());
});

// ───────────── Modération des défis ─────────────

adminRouter.get('/contents', async (_req, res) => {
  const challenges = await prisma.challenge.findMany({ orderBy: { id: 'asc' } });
  res.json(
    challenges.map((c) => ({
      id: c.id,
      title: c.title,
      subject: subjectLabel[c.subject],
      difficulty: difficultyLabel[c.difficulty],
      points: c.basePoints,
      description: shortDescription(c.statement),
      status: contentToFront[c.status],
    })),
  );
});

adminRouter.patch('/contents/:id', async (req, res) => {
  const id = ID(req.params.id);
  const status = contentFromFront[String(req.body?.status ?? '')];
  const challenge = id ? await prisma.challenge.findUnique({ where: { id } }) : null;
  if (!challenge || !status) {
    res.status(404).json({ error: 'Défi ou statut invalide.' });
    return;
  }
  await prisma.challenge.update({ where: { id: challenge.id }, data: { status } });
  const verb = status === 'PUBLISHED' ? 'publié' : status === 'HIDDEN' ? 'masqué' : 'repassé en brouillon';
  await log(req.auth!.sub, `Défi « ${challenge.title} » ${verb}`);
  res.json({ id: challenge.id, status: contentToFront[status] });
});

// ───────────── Référentiel de compétences ─────────────

async function loadReferential() {
  const [students, links] = await Promise.all([
    prisma.user.findMany({ where: { role: 'STUDENT', status: 'ACTIVE' }, select: { id: true } }),
    prisma.challengeCompetence.findMany({ select: { competence: { select: { name: true } }, challenge: { select: { subject: true } } } }),
  ]);
  const items = await competenceLevels(students.map((u) => u.id));
  const bySubject = Object.entries(subjectLabel).map(([key, label]) => ({
    subject: label,
    competences: [...new Set(links.filter((l) => l.challenge.subject === key).map((l) => l.competence.name))],
  }));
  return {
    competences: items.map((c) => ({ id: c.id, name: c.name, description: c.description, value: c.value })),
    bySubject,
  };
}

adminRouter.get('/competences', async (_req, res) => {
  res.json(await loadReferential());
});

adminRouter.post('/competences', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'Le nom est obligatoire.' });
    return;
  }
  if (await prisma.competence.findUnique({ where: { name } })) {
    res.status(409).json({ error: 'Cette compétence existe déjà.' });
    return;
  }
  await prisma.competence.create({ data: { name, description } });
  await log(req.auth!.sub, `Compétence « ${name} » ajoutée au référentiel`);
  res.status(201).json(await loadReferential());
});

adminRouter.patch('/competences/:id', async (req, res) => {
  const id = ID(req.params.id);
  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  const current = id ? await prisma.competence.findUnique({ where: { id } }) : null;
  if (!current) {
    res.status(404).json({ error: 'Compétence introuvable.' });
    return;
  }
  if (!name) {
    res.status(400).json({ error: 'Le nom est obligatoire.' });
    return;
  }
  const clash = await prisma.competence.findFirst({ where: { name, id: { not: current.id } } });
  if (clash) {
    res.status(409).json({ error: 'Cette compétence existe déjà.' });
    return;
  }
  await prisma.competence.update({ where: { id: current.id }, data: { name, description } });
  await log(req.auth!.sub, `Compétence « ${name} » modifiée`);
  res.json(await loadReferential());
});

adminRouter.delete('/competences/:id', async (req, res) => {
  const id = ID(req.params.id);
  const current = id ? await prisma.competence.findUnique({ where: { id } }) : null;
  if (!current) {
    res.status(404).json({ error: 'Compétence introuvable.' });
    return;
  }
  await prisma.competence.delete({ where: { id: current.id } });
  await log(req.auth!.sub, `Compétence « ${current.name} » retirée du référentiel`);
  res.json(await loadReferential());
});

// ───────────── Journal ─────────────

adminRouter.get('/audit', async (_req, res) => {
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
  res.json(rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), text: r.text })));
});
