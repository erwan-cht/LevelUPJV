// Données de développement : npm run db:seed
//
// ⚠️ Remet les comptes de démonstration à leur état initial à chaque lancement (mot de passe, statut,
// groupe, activité, badges, duels). Les comptes créés à la main et les défis créés par les enseignants
// ne sont pas touchés. Comptes de test : mot de passe « levelup123 » (ou SEED_PASSWORD).
import bcrypt from 'bcryptjs';
import { syncBadges } from '../src/badges.js';
import { prisma } from '../src/db.js';
import { slugify } from '../src/format.js';

const PASSWORD = process.env.SEED_PASSWORD ?? 'levelup123';
const DAY = 86_400_000;

// Générateur pseudo-aléatoire déterministe : la démo est identique d'un lancement à l'autre.
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

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
// prénom, nom, promo (code), groupe, points visés, statut, jours d'inactivité minimum
const students: [string, string, string, number, number, Status, number][] = [
  ['Léa', 'Marchand', 'BUT 2', 2, 3120, 'ACTIVE', 0],
  ['Hugo', 'Bernard', 'BUT 2', 1, 2980, 'ACTIVE', 0],
  ['Camille', 'Dubois', 'BUT 2', 3, 2760, 'ACTIVE', 0],
  ['Nathan', 'Leroy', 'BUT 2', 1, 2710, 'ACTIVE', 0],
  ['Manon', 'Fabre', 'BUT 2', 2, 2680, 'ACTIVE', 0],
  ['Louis', 'Petit', 'BUT 2', 3, 2640, 'ACTIVE', 0],
  ['Sarah', 'Morel', 'BUT 2', 2, 2590, 'ACTIVE', 0],
  ['Tom', 'Girard', 'BUT 2', 1, 2540, 'ACTIVE', 0],
  ['Emma', 'Roux', 'BUT 2', 3, 2510, 'ACTIVE', 0],
  ['Lucas', 'André', 'BUT 2', 1, 2490, 'ACTIVE', 0],
  ['Jade', 'Henry', 'BUT 2', 2, 2465, 'ACTIVE', 0],
  ['Oscar', 'Lescot', 'BUT 2', 2, 2450, 'ACTIVE', 0],
  ['Enzo', 'Lopez', 'BUT 2', 2, 2420, 'ACTIVE', 0],
  ['Inès', 'Robin', 'BUT 2', 2, 2210, 'ACTIVE', 0],
  ['Théo', 'Blanc', 'BUT 2', 3, 2150, 'ACTIVE', 0],
  ['Chloé', 'Martin', 'BUT 2', 1, 2080, 'ACTIVE', 0],
  ['Yanis', 'Blanc', 'BUT 1', 1, 620, 'ACTIVE', 9],
  ['Thomas', 'Roux', 'BUT 3', 1, 900, 'ACTIVE', 12],
  ['Mehdi', 'Aubert', 'BUT 3', 2, 300, 'SUSPENDED', 20],
  ['Alice', 'Vasseur', 'BUT 1', 2, 0, 'PENDING', 0],
  ['Rayan', 'Caron', 'BUT 1', 2, 0, 'PENDING', 0],
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

  // Connexions récentes des enseignants et de l'administrateur
  for (const [n, email] of [...teachers.map((t) => t.email), 'admin.dsi@iut.example'].entries()) {
    await prisma.user.update({ where: { email }, data: { lastLoginAt: new Date(Date.now() - (n + 1) * 5 * 3600_000) } });
  }

  // Étudiants
  const demoIds: number[] = [];
  for (const [firstName, lastName, promo, g, , status] of students) {
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

  // ───────────── Activité de démonstration (remise à zéro des comptes de démo) ─────────────
  await prisma.duel.deleteMany({ where: { OR: [{ challengerId: { in: demoIds } }, { opponentId: { in: demoIds } }] } });
  await prisma.attempt.deleteMany({ where: { userId: { in: demoIds } } });
  await prisma.pointEvent.deleteMany({ where: { userId: { in: demoIds } } });
  await prisma.userBadge.deleteMany({ where: { userId: { in: demoIds } } });
  await prisma.hint.deleteMany({ where: { userId: { in: demoIds } } });
  await prisma.favorite.deleteMany({ where: { userId: { in: demoIds } } });

  const catalog = await prisma.challenge.findMany({ where: { status: 'PUBLISHED' }, orderBy: { id: 'asc' } });
  const byTitle = new Map(catalog.map((c) => [c.title, c]));
  const now = Date.now();

  for (const [i, [firstName, lastName, , , target, status, idle]] of students.entries()) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: emailOf(firstName, lastName) } });
    if (target === 0 || status === 'PENDING') {
      await prisma.user.update({ where: { id: user.id }, data: { points: 0, xp: 0, streakDays: 0, bestStreak: 0, lastActiveDay: null } });
      continue;
    }
    const rand = rng(1000 + i * 97);
    const shuffle = <T,>(a: T[]) => [...a].sort(() => rand() - 0.5);
    const isOscar = firstName === 'Oscar';

    // Défis réussis : une part du catalogue proportionnelle aux points visés, sans dépasser la cible
    let pool = shuffle(catalog);
    if (firstName === 'Enzo') pool = pool.filter((c) => c.subject !== 'DATABASES'); // bloqué en bases de données
    // Oscar n'a pas encore fait les défis recommandés par son enseignante.
    if (isOscar) {
      const todo = ['Requêtes imbriquées', 'Jointures externes (LEFT JOIN)', 'Statistiques par ville', 'Jointures et sous-requêtes', 'Formulaire responsive', "Tri d'un tableau"];
      pool = pool.filter((c) => !todo.includes(c.title));
    }
    if (firstName === 'Jade') pool = pool.filter((c) => c.title !== 'Récursivité : la factorielle');
    let k = Math.min(pool.length, Math.round(catalog.length * (0.2 + 0.5 * Math.min(target / 3200, 1))));
    let solved = pool.slice(0, k);
    while (solved.reduce((s, c) => s + c.basePoints, 0) > target && solved.length > 0) solved = solved.slice(0, --k);

    const events: { points: number; at: Date; reason: string }[] = [];
    const attempts: { challengeId: number; status: 'PASSED' | 'FAILED'; at: Date; passed: number }[] = [];
    const TOTAL = 4;
    const minDay = isOscar ? 8 : idle > 0 ? idle : 1;

    for (const c of solved) {
      const day = minDay + Math.floor(Math.pow(rand(), 1.3) * (60 - minDay));
      const hour = rand() < 0.04 ? Math.floor(rand() * 5) : 8 + Math.floor(rand() * 14);
      const done = new Date(now - day * DAY);
      done.setHours(hour, Math.floor(rand() * 60), 0, 0);
      const fails = c.difficulty === 'HARD' ? 1 + Math.floor(rand() * 3) : Math.floor(rand() * 3);
      for (let f = fails; f > 0; f--) {
        attempts.push({ challengeId: c.id, status: 'FAILED', at: new Date(done.getTime() - f * (3 + Math.floor(rand() * 9)) * 60_000), passed: Math.floor(rand() * TOTAL) });
      }
      attempts.push({ challengeId: c.id, status: 'PASSED', at: done, passed: TOTAL });
      events.push({ points: c.basePoints, at: done, reason: `demo:challenge:${c.id}` });
    }

    // Élèves « en difficulté » : de nombreux essais ratés, sans réussite
    const stuck = (titles: string[], count: number) => {
      for (const title of titles) {
        const c = byTitle.get(title);
        if (!c) continue;
        for (let n = 0; n < count; n++) {
          attempts.push({ challengeId: c.id, status: 'FAILED', at: new Date(now - (2 + n) * DAY - rand() * DAY), passed: Math.floor(rand() * 2) });
        }
      }
    };
    if (isOscar) {
      // Défis commencés : une tentative ratée avec une partie des tests réussis.
      const started: [string, number, number][] = [['Jointures et sous-requêtes', 3, DAY], ['Formulaire responsive', 1, 3 * 3600_000]];
      for (const [title, passed, ago] of started) {
        const c = byTitle.get(title);
        if (c) attempts.push({ challengeId: c.id, status: 'FAILED', at: new Date(now - ago), passed });
      }
    }
    if (firstName === 'Enzo') stuck(['Sélections simples', 'Jointures et sous-requêtes'], 5);
    if (firstName === 'Jade') stuck(['Récursivité : la factorielle'], 4);

    // Semaine type d'Oscar (la maquette) : 50, 60, 120, 90, 60 points sur les 5 derniers jours
    if (isOscar) {
      [0, 0, 50, 60, 120, 90, 60].forEach((points, n) => {
        if (points === 0) return;
        const at = new Date(now - (6 - n) * DAY);
        at.setHours(12, 0, 0, 0);
        if (at.getTime() > now) at.setTime(now - 60_000);
        events.push({ points, at, reason: 'demo:week' });
      });
    }

    // Le reste des points : bonus réguliers (séries, badges, duels…) répartis sur deux mois
    let rest = target - events.reduce((s, e) => s + e.points, 0);
    while (rest > 0) {
      const points = Math.min(rest, 10 + Math.floor(rand() * 4) * 10);
      const day = minDay + Math.floor(Math.pow(rand(), 1.8) * (60 - minDay));
      const at = new Date(now - day * DAY);
      at.setHours(9 + Math.floor(rand() * 12), Math.floor(rand() * 60), 0, 0);
      events.push({ points, at, reason: 'demo:bonus' });
      rest -= points;
    }

    // Gains des 7 derniers jours plafonnés (hors Oscar) : l'évolution du rang reste plausible.
    if (!isOscar) {
      const cap = 120 + Math.floor(rand() * 100);
      const recent = () => events.filter((e) => e.at.getTime() >= now - 7 * DAY);
      while (recent().reduce((s, e) => s + e.points, 0) > cap) {
        const latest = recent().sort((a, b) => b.at.getTime() - a.at.getTime())[0];
        const shift = (8 + Math.floor(rand() * 7)) * DAY;
        const before = latest.at.getTime();
        latest.at = new Date(before - shift);
        const m = /demo:challenge:(\d+)/.exec(latest.reason);
        if (m) for (const a of attempts) if (a.challengeId === Number(m[1]) && Math.abs(a.at.getTime() - before) < DAY) a.at = new Date(a.at.getTime() - shift);
      }
    }

    await prisma.attempt.createMany({
      data: attempts.map((a) => ({
        userId: user.id,
        challengeId: a.challengeId,
        answer: '-- démo',
        status: a.status,
        testsPassed: a.passed,
        testsTotal: TOTAL,
        createdAt: a.at,
      })),
    });
    await prisma.pointEvent.createMany({ data: events.map((e) => ({ userId: user.id, points: e.points, xp: e.points, reason: e.reason, createdAt: e.at })) });

    // Série : jours consécutifs avec des points (en cours si le dernier jour est aujourd'hui ou hier)
    const days = [...new Set(events.map((e) => Math.floor(new Date(e.at).setHours(0, 0, 0, 0) / DAY)))].sort((a, b) => a - b);
    let best = 0;
    let run = 0;
    days.forEach((d, n) => {
      run = n > 0 && d === days[n - 1] + 1 ? run + 1 : 1;
      best = Math.max(best, run);
    });
    const today = Math.floor(new Date().setHours(0, 0, 0, 0) / DAY);
    const last = days[days.length - 1];
    const current = last >= today - 1 ? run : 0;
    const total = events.reduce((s, e) => s + e.points, 0);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        points: total,
        xp: total,
        streakDays: current,
        bestStreak: best,
        lastActiveDay: new Date(last * DAY),
        lastSeenAt: null,
        lastLoginAt: new Date(Math.max(...events.map((e) => e.at.getTime()))),
      },
    });
  }

  // Badges gagnés (règles évaluées sur l'activité), puis récompenses réclamées pour une partie d'entre eux
  for (const [i, [firstName, lastName, , , target]] of students.entries()) {
    if (target === 0) continue;
    const user = await prisma.user.findUniqueOrThrow({ where: { email: emailOf(firstName, lastName) } });
    const states = await syncBadges(user.id);
    const earned = states.filter((b) => b.earned);
    const rand = rng(5000 + i);
    const isOscar = firstName === 'Oscar';
    for (const [n, b] of earned.entries()) {
      // Oscar garde ses deux premiers badges à réclamer, pour montrer le bouton « Réclamer ».
      const claimed = isOscar ? n >= 2 : rand() < 0.6;
      await prisma.userBadge.update({ where: { userId_badgeId: { userId: user.id, badgeId: b.id } }, data: { claimed } });
    }
  }

  // Duels de démonstration pour Oscar : une défaite contre Léa et une invitation de Hugo
  const byName = (f: string, l: string) => prisma.user.findUniqueOrThrow({ where: { email: emailOf(f, l) } });
  const [oscar, lea, hugo] = await Promise.all([byName('Oscar', 'Lescot'), byName('Léa', 'Marchand'), byName('Hugo', 'Bernard')]);
  const sqlChallenge = catalog.find((c) => c.type === 'SQL' && c.difficulty === 'EASY' && c.solutionSql);
  const mediumSql = catalog.find((c) => c.type === 'SQL' && c.difficulty === 'MEDIUM' && c.solutionSql);
  if (sqlChallenge && mediumSql) {
    const start = new Date(now - 2 * DAY);
    const duel = await prisma.duel.create({
      data: {
        challengerId: lea.id, opponentId: oscar.id, challengeId: sqlChallenge.id, status: 'FINISHED', winnerId: lea.id,
        ranked: true, stakePoints: 60, startedAt: start, finishedAt: new Date(start.getTime() + 5 * 60_000), createdAt: start,
      },
    });
    await prisma.duelEvent.createMany({
      data: [
        { duelId: duel.id, text: 'Le duel a commencé.', createdAt: start },
        { duelId: duel.id, userId: lea.id, text: 'Solution validée : victoire !', createdAt: new Date(start.getTime() + 5 * 60_000) },
      ],
    });
    await prisma.duel.create({ data: { challengerId: hugo.id, opponentId: oscar.id, challengeId: mediumSql.id, ranked: true, stakePoints: 60 } });
  }

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
