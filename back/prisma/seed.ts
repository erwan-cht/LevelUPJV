// Données de développement : npm run db:seed
//
// Crée les comptes de démonstration, les promotions, les groupes et les défis, SANS activité inventée :
// les comptes repartent avec 0 point, sans tentative, badge ni duel.
// ⚠️ Remet les comptes de démonstration à leur état initial à chaque lancement (mot de passe, statut,
// groupe, points et activité remis à zéro). Les comptes créés à la main et les défis créés par les enseignants
// ne sont pas touchés. Comptes de test : mot de passe « levelup123 » (ou SEED_PASSWORD).
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db.js';
import { slugify } from '../src/format.js';

const PASSWORD = process.env.SEED_PASSWORD ?? 'levelup123';
const DAY = 86_400_000;

// ───────────── Compétences du référentiel BUT ─────────────
const competences = [
  { name: 'Réaliser un développement d’application', description: 'Développer des applications informatiques', skills: ['Implémenter des algorithmes', 'Développer des interfaces web', 'Tester une application'] },
  { name: 'Optimiser des applications', description: 'Optimiser des applications', skills: ['Analyser la complexité', 'Optimiser des requêtes SQL', 'Profiler une application'] },
  { name: 'Administrer des systèmes d’information', description: 'Administrer des systèmes d’information', skills: ['Configurer un système Linux', 'Gérer les droits et les services', 'Superviser un réseau'] },
  { name: 'Gérer les données de l’information', description: 'Gérer des données de l’information', skills: ['Modéliser une base de données', 'Écrire des requêtes avancées', 'Sécuriser les données'] },
  { name: 'Conduire un projet', description: 'Conduire un projet', skills: ['Planifier un projet', 'Utiliser Git en équipe', 'Rédiger une documentation'] },
  { name: 'Collaborer au sein d’une équipe', description: 'Collaborer au sein d’une équipe', skills: ['Travailler en équipe', 'Communiquer avec un client', 'Présenter un travail'] },
];
const [REALISER, OPTIMISER, ADMINISTRER, GERER] = competences.map((c) => c.name);

// ───────────── Badges (règle = mesure + seuil, évaluée par src/badges.ts) ─────────────
const badges = [
  { slug: 'premier-pas', name: 'Premier pas', description: 'Réussir ton premier défi.', rewardPoints: 20, variant: 'navy', metric: 'PASSED_TOTAL', threshold: 1 },
  { slug: 'rookie-defis', name: 'Rookie des défis', description: 'Terminer 5 défis.', rewardPoints: 60, variant: 'navy', metric: 'PASSED_TOTAL', threshold: 5 },
  { slug: 'legende', name: 'Légende', description: 'Terminer 20 défis.', rewardPoints: 200, variant: 'orange', metric: 'PASSED_TOTAL', threshold: 20 },
  { slug: 'sql-master', name: 'SQL Master', description: 'Réussir 5 défis de bases de données.', rewardPoints: 100, variant: 'orange', metric: 'PASSED_DATABASES', threshold: 5 },
  { slug: 'algorithmicien', name: 'Algorithmicien', description: 'Terminer 5 défis d’algorithmique.', rewardPoints: 100, variant: 'navy', metric: 'PASSED_ALGORITHMICS', threshold: 5 },
  { slug: 'web-designer', name: 'Web designer', description: 'Terminer 3 défis web.', rewardPoints: 70, variant: 'navy', metric: 'PASSED_WEB_DEV', threshold: 3 },
  { slug: 'administrateur', name: 'Administrateur', description: 'Terminer 3 défis réseaux et systèmes.', rewardPoints: 70, variant: 'navy', metric: 'PASSED_NETWORKS_SYSTEMS', threshold: 3 },
  { slug: 'premiere-serie', name: 'Première série', description: 'Atteindre une série de 3 jours.', rewardPoints: 40, variant: 'navy', metric: 'STREAK', threshold: 3 },
  { slug: 'serie-5-jours', name: 'Série 5 jours', description: 'Être actif 5 jours de suite.', rewardPoints: 50, variant: 'navy', metric: 'STREAK', threshold: 5 },
  { slug: 'marathonien', name: 'Marathonien', description: 'Atteindre une série de 30 jours.', rewardPoints: 150, variant: 'orange', metric: 'STREAK', threshold: 30 },
  { slug: 'top-10-promo', name: 'Top 10 promo', description: 'Entrer dans le top 10 de ta promo.', rewardPoints: 120, variant: 'orange', metric: 'TOP_RANK', threshold: 10 },
  { slug: 'duelliste', name: 'Duelliste', description: 'Gagner ton premier duel.', rewardPoints: 50, variant: 'navy', metric: 'DUELS_WON', threshold: 1 },
  { slug: 'gladiateur', name: 'Gladiateur', description: 'Gagner 3 duels.', rewardPoints: 80, variant: 'orange', metric: 'DUELS_WON', threshold: 3 },
  { slug: 'full-stack', name: 'Full-stack', description: 'Réussir des défis dans 3 matières.', rewardPoints: 150, variant: 'orange', metric: 'SUBJECTS_DONE', threshold: 3 },
  { slug: 'explorateur', name: 'Explorateur', description: 'Réussir des défis dans les 4 matières.', rewardPoints: 100, variant: 'navy', metric: 'SUBJECTS_DONE', threshold: 4 },
  { slug: 'perfectionniste', name: 'Perfectionniste', description: 'Réussir 5 défis dès la première tentative.', rewardPoints: 90, variant: 'navy', metric: 'FIRST_TRY', threshold: 5 },
  { slug: 'noctambule', name: 'Noctambule', description: 'Réussir un défi entre minuit et 5 h.', rewardPoints: 30, variant: 'navy', metric: 'NIGHT_PASSES', threshold: 1 },
];

// ───────────── Défis ─────────────
const SHOP = `
CREATE TABLE clients (id INTEGER PRIMARY KEY, nom TEXT, ville TEXT);
CREATE TABLE commandes (id INTEGER PRIMARY KEY, client_id INTEGER, montant REAL, date_commande TEXT);
INSERT INTO clients VALUES (1,'Alice','Amiens'),(2,'Bob','Paris'),(3,'Chloé','Amiens'),(4,'David','Lille');
INSERT INTO commandes VALUES (1,1,45.0,'2026-01-10'),(2,1,20.0,'2026-02-02'),(3,2,99.9,'2026-02-14'),(4,3,12.5,'2026-03-01');
`.trim();

type SubjectKey = 'DATABASES' | 'ALGORITHMICS' | 'WEB_DEV' | 'NETWORKS_SYSTEMS';
type Level = 'EASY' | 'MEDIUM' | 'HARD';
interface Seed {
  title: string;
  subject: SubjectKey;
  difficulty: Level;
  minutes: number;
  points: number;
  statement: string;
  competence: string;
  status?: 'PUBLISHED' | 'DRAFT' | 'HIDDEN';
  sql?: { solution: string };
  tests?: { label: string; input: string; expected: string; hidden?: boolean }[];
}

const typeOf = { DATABASES: 'ALGO', ALGORITHMICS: 'ALGO', WEB_DEV: 'WEB', NETWORKS_SYSTEMS: 'NETWORK' } as const;

const challenges: Seed[] = [
  // Bases de données : les défis avec `sql` sont corrigés automatiquement
  { title: 'Sélections simples', subject: 'DATABASES', difficulty: 'EASY', minutes: 15, points: 40, competence: GERER, statement: 'Affiche le nom des clients qui habitent à **Amiens**, triés par nom.', sql: { solution: "SELECT nom FROM clients WHERE ville = 'Amiens' ORDER BY nom;" } },
  { title: 'Compter les clients', subject: 'DATABASES', difficulty: 'EASY', minutes: 15, points: 40, competence: GERER, statement: 'Combien de clients habitent à **Amiens** ? Renvoie une seule valeur.', sql: { solution: "SELECT COUNT(*) FROM clients WHERE ville = 'Amiens';" } },
  { title: 'Jointures et sous-requêtes', subject: 'DATABASES', difficulty: 'MEDIUM', minutes: 25, points: 80, competence: GERER, statement: 'Affiche chaque client avec le **total** de ses commandes (les clients sans commande n’apparaissent pas).', sql: { solution: 'SELECT c.nom, SUM(o.montant) AS total FROM clients c JOIN commandes o ON o.client_id = c.id GROUP BY c.id, c.nom;' } },
  { title: 'Agrégats et GROUP BY', subject: 'DATABASES', difficulty: 'MEDIUM', minutes: 20, points: 60, competence: GERER, statement: 'Pour chaque ville, donne le **nombre de clients**.', sql: { solution: 'SELECT ville, COUNT(*) AS nb FROM clients GROUP BY ville;' } },
  { title: 'Requêtes imbriquées', subject: 'DATABASES', difficulty: 'MEDIUM', minutes: 30, points: 70, competence: GERER, statement: 'Affiche les clients qui ont passé **au moins une commande de plus de 50 €**, triés par nom.', sql: { solution: 'SELECT nom FROM clients WHERE id IN (SELECT client_id FROM commandes WHERE montant > 50) ORDER BY nom;' } },
  { title: 'Jointures externes (LEFT JOIN)', subject: 'DATABASES', difficulty: 'MEDIUM', minutes: 30, points: 80, competence: GERER, statement: 'Liste **tous** les clients avec leur nombre de commandes (0 s’ils n’en ont pas), triés par nom.', sql: { solution: 'SELECT c.nom, COUNT(o.id) AS nb FROM clients c LEFT JOIN commandes o ON o.client_id = c.id GROUP BY c.id, c.nom ORDER BY c.nom;' } },
  { title: 'Statistiques par ville', subject: 'DATABASES', difficulty: 'HARD', minutes: 45, points: 110, competence: OPTIMISER, statement: 'Pour chaque ville, calcule le **montant total** des commandes, en ne gardant que les villes dont le total dépasse 50 €. Trie du plus grand au plus petit total.', sql: { solution: 'SELECT c.ville, SUM(o.montant) AS total FROM clients c JOIN commandes o ON o.client_id = c.id GROUP BY c.ville HAVING SUM(o.montant) > 50 ORDER BY total DESC;' } },
  { title: 'Modélisation MCD', subject: 'DATABASES', difficulty: 'MEDIUM', minutes: 35, points: 70, competence: GERER, statement: 'Passer du besoin au modèle conceptuel de données.' },
  { title: 'Vues et index', subject: 'DATABASES', difficulty: 'HARD', minutes: 40, points: 100, competence: OPTIMISER, status: 'DRAFT', statement: 'Optimiser et sécuriser l’accès aux données.' },
  // Algorithmique
  { title: 'Récursivité : la factorielle', subject: 'ALGORITHMICS', difficulty: 'EASY', minutes: 20, points: 45, competence: REALISER, statement: 'Découvrir les appels récursifs et le cas de base.' },
  { title: "Tri d'un tableau", subject: 'ALGORITHMICS', difficulty: 'EASY', minutes: 20, points: 40, competence: REALISER, statement: 'Écris une fonction `trier(tab)` qui trie une liste d’entiers **sans utiliser** `sorted()`.', tests: [{ label: 'Liste désordonnée', input: '[3,1,2]', expected: '[1,2,3]' }, { label: 'Liste vide', input: '[]', expected: '[]' }, { label: 'Doublons', input: '[2,2,1]', expected: '[1,2,2]' }, { label: 'Déjà triée', input: '[1,2,3]', expected: '[1,2,3]', hidden: true }] },
  { title: 'Recherche dichotomique', subject: 'ALGORITHMICS', difficulty: 'EASY', minutes: 15, points: 40, competence: REALISER, statement: 'Chercher efficacement dans une liste triée.' },
  { title: 'Piles et files', subject: 'ALGORITHMICS', difficulty: 'MEDIUM', minutes: 30, points: 60, competence: REALISER, status: 'DRAFT', statement: 'Implémenter les structures LIFO et FIFO.' },
  { title: 'Complexité algorithmique', subject: 'ALGORITHMICS', difficulty: 'MEDIUM', minutes: 25, points: 60, competence: OPTIMISER, statement: 'Comparer des algorithmes selon leur coût.' },
  { title: 'Graphes : parcours', subject: 'ALGORITHMICS', difficulty: 'HARD', minutes: 45, points: 120, competence: OPTIMISER, statement: 'Parcours en largeur et en profondeur.' },
  // Développement web
  { title: 'Formulaire responsive', subject: 'WEB_DEV', difficulty: 'HARD', minutes: 45, points: 120, competence: REALISER, statement: 'Construis un formulaire de contact accessible qui s’adapte aux petits écrans.' },
  { title: 'DOM et événements', subject: 'WEB_DEV', difficulty: 'MEDIUM', minutes: 30, points: 70, competence: REALISER, statement: 'Manipuler le DOM en réagissant aux actions.' },
  { title: 'API REST', subject: 'WEB_DEV', difficulty: 'MEDIUM', minutes: 40, points: 100, competence: REALISER, statement: 'Consommer et exposer une API JSON.' },
  { title: 'Sessions PHP', subject: 'WEB_DEV', difficulty: 'MEDIUM', minutes: 30, points: 80, competence: REALISER, statement: 'Gérer connexion et sessions côté serveur.' },
  { title: 'Accessibilité', subject: 'WEB_DEV', difficulty: 'MEDIUM', minutes: 25, points: 60, competence: REALISER, statement: 'Rendre une page lisible pour tous.' },
  { title: 'Flexbox et Grid', subject: 'WEB_DEV', difficulty: 'EASY', minutes: 20, points: 50, competence: REALISER, statement: 'Composer des mises en page modernes.' },
  // Réseaux et systèmes
  { title: 'Sous-réseaux IPv4', subject: 'NETWORKS_SYSTEMS', difficulty: 'MEDIUM', minutes: 30, points: 110, competence: ADMINISTRER, statement: 'Découpe le réseau `192.168.1.0/24` en 4 sous-réseaux égaux.' },
  { title: 'Adressage IPv4', subject: 'NETWORKS_SYSTEMS', difficulty: 'EASY', minutes: 20, points: 50, competence: ADMINISTRER, statement: 'Classes, masques et adresses privées.' },
  { title: 'Scripts Bash', subject: 'NETWORKS_SYSTEMS', difficulty: 'MEDIUM', minutes: 30, points: 80, competence: ADMINISTRER, statement: 'Automatiser des tâches avec des scripts.' },
  { title: 'Droits et permissions', subject: 'NETWORKS_SYSTEMS', difficulty: 'MEDIUM', minutes: 25, points: 70, competence: ADMINISTRER, statement: 'Maîtriser chmod, chown et les ACL.' },
  { title: 'Docker : premier pas', subject: 'NETWORKS_SYSTEMS', difficulty: 'HARD', minutes: 40, points: 110, competence: ADMINISTRER, status: 'HIDDEN', statement: 'Lancer et configurer un conteneur.' },
  { title: 'Commandes Linux', subject: 'NETWORKS_SYSTEMS', difficulty: 'EASY', minutes: 15, points: 30, competence: ADMINISTRER, statement: 'Se repérer et agir dans un terminal.' },
];

// ───────────── Comptes ─────────────
type Status = 'ACTIVE' | 'SUSPENDED' | 'PENDING';
// prénom, nom, promo (code), groupe, statut
const students: [string, string, string, number, Status][] = [
  ['Léa', 'Marchand', 'BUT 2', 2, 'ACTIVE'],
  ['Hugo', 'Bernard', 'BUT 2', 1, 'ACTIVE'],
  ['Camille', 'Dubois', 'BUT 2', 3, 'ACTIVE'],
  ['Nathan', 'Leroy', 'BUT 2', 1, 'ACTIVE'],
  ['Manon', 'Fabre', 'BUT 2', 2, 'ACTIVE'],
  ['Louis', 'Petit', 'BUT 2', 3, 'ACTIVE'],
  ['Sarah', 'Morel', 'BUT 2', 2, 'ACTIVE'],
  ['Tom', 'Girard', 'BUT 2', 1, 'ACTIVE'],
  ['Emma', 'Roux', 'BUT 2', 3, 'ACTIVE'],
  ['Lucas', 'André', 'BUT 2', 1, 'ACTIVE'],
  ['Jade', 'Henry', 'BUT 2', 2, 'ACTIVE'],
  ['Oscar', 'Lescot', 'BUT 2', 2, 'ACTIVE'],
  ['Enzo', 'Lopez', 'BUT 2', 2, 'ACTIVE'],
  ['Inès', 'Robin', 'BUT 2', 2, 'ACTIVE'],
  ['Théo', 'Blanc', 'BUT 2', 3, 'ACTIVE'],
  ['Chloé', 'Martin', 'BUT 2', 1, 'ACTIVE'],
  ['Yanis', 'Blanc', 'BUT 1', 1, 'ACTIVE'],
  ['Thomas', 'Roux', 'BUT 3', 1, 'ACTIVE'],
  ['Mehdi', 'Aubert', 'BUT 3', 2, 'SUSPENDED'],
  ['Alice', 'Vasseur', 'BUT 1', 2, 'PENDING'],
  ['Rayan', 'Caron', 'BUT 1', 2, 'PENDING'],
];

const teachers = [
  { email: 'm.dupuis@iut.example', firstName: 'Marie', lastName: 'Dupuis', pseudo: 'mme-dupuis', teaches: 'Bases de données, Web' },
  { email: 'j.loge@iut.example', firstName: 'Julien', lastName: 'Loge', pseudo: 'j-loge', teaches: 'Algorithmique' },
  { email: 'k.haddad@iut.example', firstName: 'Karim', lastName: 'Haddad', pseudo: 'k-haddad', teaches: 'Réseaux & systèmes' },
];

const promotions = [
  { name: 'BUT 1 Informatique', code: 'BUT 1', groups: 3, referent: 'k.haddad@iut.example' },
  { name: 'BUT 2 Informatique', code: 'BUT 2', groups: 3, referent: 'm.dupuis@iut.example' },
  { name: 'BUT 3 Informatique', code: 'BUT 3', groups: 2, referent: 'j.loge@iut.example' },
];

const emailOf = (first: string, last: string) => `${slugify(first)}.${slugify(last)}@etu.example`;

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Compétences et badges
  const comp: Record<string, number> = {};
  for (const c of competences) {
    comp[c.name] = (await prisma.competence.upsert({ where: { name: c.name }, update: c, create: c })).id;
  }
  for (const badge of badges) await prisma.badge.upsert({ where: { slug: badge.slug }, update: badge, create: badge });

  // Enseignants, administrateur
  const teacher: Record<string, number> = {};
  for (const t of teachers) {
    const base = { createdAt: new Date('2026-08-28T09:00:00Z'), firstName: t.firstName, lastName: t.lastName, teaches: t.teaches, role: 'TEACHER' as const, status: 'ACTIVE' as const, passwordHash };
    teacher[t.email] = (await prisma.user.upsert({ where: { email: t.email }, update: base, create: { email: t.email, pseudo: t.pseudo, ...base } })).id;
  }
  await prisma.user.upsert({
    where: { email: 'admin.dsi@iut.example' },
    update: { passwordHash, role: 'ADMIN', status: 'ACTIVE', createdAt: new Date('2026-08-20T09:00:00Z') },
    create: { email: 'admin.dsi@iut.example', passwordHash, role: 'ADMIN', firstName: 'Service', lastName: 'DSI', pseudo: 'admin-dsi' },
  });

  // Promotions et groupes
  const groupId = new Map<string, number>();
  for (const p of promotions) {
    await prisma.promotion.upsert({
      where: { code: p.code },
      update: { name: p.name, referentId: teacher[p.referent] },
      create: { name: p.name, code: p.code, year: '2026-2027', referentId: teacher[p.referent] },
    });
    for (let n = 1; n <= p.groups; n++) {
      const name = `${p.code} · Groupe ${n}`;
      const g = await prisma.group.upsert({
        where: { promo_name: { promo: p.code, name } },
        update: { teacherId: teacher[p.referent] },
        create: { name, promo: p.code, teacherId: teacher[p.referent] },
      });
      groupId.set(`${p.code}|${n}`, g.id);
    }
  }

  // Défis (créés une seule fois : le statut et les réglages modifiés ensuite sont conservés)
  const author = teacher['m.dupuis@iut.example'];
  for (const c of challenges) {
    if (await prisma.challenge.findFirst({ where: { title: c.title } })) continue;
    await prisma.challenge.create({
      data: {
        title: c.title,
        statement: c.statement,
        type: c.sql ? 'SQL' : typeOf[c.subject],
        subject: c.subject,
        difficulty: c.difficulty,
        minutes: c.minutes,
        basePoints: c.points,
        status: c.status ?? 'PUBLISHED',
        authorId: author,
        setupSql: c.sql ? SHOP : null,
        solutionSql: c.sql?.solution ?? null,
        starterCode: c.sql ? 'SELECT ' : c.tests ? 'def trier(tab):\n    pass\n' : null,
        competences: { create: { competenceId: comp[c.competence] } },
        tests: { create: (c.tests ?? []).map((t, i) => ({ ...t, position: i })) },
      },
    });
  }

  // Étudiants
  const demoIds: number[] = [];
  for (const [firstName, lastName, promo, g, status] of students) {
    const email = emailOf(firstName, lastName);
    const joined = status === 'PENDING' ? new Date(Date.now() - (firstName === 'Alice' ? 3 : 1) * DAY) : new Date('2026-09-02T09:00:00Z');
    const data = { createdAt: joined, firstName, lastName, role: 'STUDENT' as const, status, groupId: groupId.get(`${promo}|${g}`)!, passwordHash };
    const u = await prisma.user.upsert({
      where: { email },
      update: data,
      create: { email, pseudo: `${slugify(firstName)}${slugify(lastName).slice(0, 1)}`, ...data },
    });
    demoIds.push(u.id);
  }

  // ───────────── Remise à zéro des comptes de démonstration ─────────────
  // Aucune activité n'est inventée : points, XP, série, badges, tentatives et duels repartent de zéro.
  await prisma.duel.deleteMany({ where: { OR: [{ challengerId: { in: demoIds } }, { opponentId: { in: demoIds } }] } });
  await prisma.attempt.deleteMany({ where: { userId: { in: demoIds } } });
  await prisma.pointEvent.deleteMany({ where: { userId: { in: demoIds } } });
  await prisma.userBadge.deleteMany({ where: { userId: { in: demoIds } } });
  await prisma.hint.deleteMany({ where: { userId: { in: demoIds } } });
  await prisma.favorite.deleteMany({ where: { userId: { in: demoIds } } });
  await prisma.user.updateMany({
    where: { id: { in: demoIds } },
    data: { points: 0, xp: 0, streakDays: 0, bestStreak: 0, lastActiveDay: null, lastSeenAt: null, lastLoginAt: null },
  });

  const catalog = await prisma.challenge.findMany({ where: { status: 'PUBLISHED' }, orderBy: { id: 'asc' } });
  const byTitle = new Map(catalog.map((c) => [c.title, c]));
  const now = Date.now();

  // Un défi recommandé par l'enseignante au groupe d'Oscar (une seule fois)
  const recommended = byTitle.get('Requêtes imbriquées');
  const g2 = groupId.get('BUT 2|2');
  if (recommended && g2 && !(await prisma.assignment.findFirst({ where: { challengeId: recommended.id, groupId: g2 } }))) {
    await prisma.assignment.create({ data: { challengeId: recommended.id, groupId: g2, createdById: author, durationMin: 30 } });
  }

  // Journal d'administration d'exemple (si vide)
  if ((await prisma.auditLog.count()) === 0) {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin.dsi@iut.example' } });
    await prisma.auditLog.createMany({
      data: [
        { actorId: admin.id, text: 'Défi « Vues et index » repassé en brouillon', createdAt: new Date(now - 30 * 60 * 60_000) },
        { actorId: admin.id, text: 'Compte de Mehdi Aubert suspendu', createdAt: new Date(now - 26 * 60 * 60_000) },
        { actorId: admin.id, text: 'Compte de Rayan Caron créé (import ENT)', createdAt: new Date(now - 3 * 60 * 60_000) },
      ],
    });
  }

  const [users, chals, attempts] = await Promise.all([prisma.user.count(), prisma.challenge.count(), prisma.attempt.count()]);
  console.log(`✔ Seed terminé : ${users} utilisateurs, ${chals} défis, ${attempts} tentatives, ${badges.length} badges.`);
  console.log('  Comptes (mot de passe ' + (process.env.SEED_PASSWORD ? 'SEED_PASSWORD' : PASSWORD) + ') :');
  console.log('    étudiant      oscar.lescot   (ou <prénom>.<nom>@etu.example)');
  console.log('    enseignant    m.dupuis       (j.loge, k.haddad)');
  console.log('    admin         admin.dsi');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
