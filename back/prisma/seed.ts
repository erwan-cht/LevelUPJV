// Données de départ pour le développement : npm run db:seed
// Relançable sans risque : tout est en upsert, aucun doublon.
// ⚠️ Comptes de test uniquement : mot de passe « levelup123 » pour tous.
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db.js';

// Mot de passe des comptes de test. Sur un serveur public, définir SEED_PASSWORD avec une valeur secrète.
const PASSWORD = process.env.SEED_PASSWORD ?? 'levelup123';

// ───────────── Compétences du référentiel ─────────────
const competences = [
  { name: 'Gérer les données de l’information', description: 'Concevoir, interroger et administrer des bases de données.' },
  { name: 'Réaliser un développement d’application', description: 'Concevoir et programmer des applications.' },
  { name: 'Administrer des systèmes d’information', description: 'Réseaux, systèmes et exploitation.' },
];

// ───────────── Badges ─────────────
const badges = [
  { slug: 'premier-pas', name: 'Premier pas', description: 'Réussir ton premier défi.', rewardPoints: 20, variant: 'navy' },
  { slug: 'sql-master', name: 'SQL Master', description: 'Réussir 10 défis de bases de données.', rewardPoints: 100, variant: 'orange' },
  { slug: 'serie-5-jours', name: 'Série 5 jours', description: 'Être actif 5 jours de suite.', rewardPoints: 50, variant: 'navy' },
  { slug: 'top-10-promo', name: 'Top 10 promo', description: 'Entrer dans le top 10 de ta promo.', rewardPoints: 100, variant: 'orange' },
  { slug: 'duelliste', name: 'Duelliste', description: 'Gagner 3 duels.', rewardPoints: 80, variant: 'navy' },
  { slug: 'full-stack', name: 'Full-stack', description: 'Réussir des défis dans 3 matières.', rewardPoints: 150, variant: 'orange' },
];

// ───────────── Étudiants (repris de la maquette) ─────────────
// prénom, nom, groupe, xp, points
const students: [string, string, number, number, number][] = [
  ['Léa', 'Marchand', 2, 1480, 3120],
  ['Hugo', 'Bernard', 1, 1420, 2980],
  ['Camille', 'Dubois', 3, 1390, 2760],
  ['Nathan', 'Leroy', 1, 1360, 2710],
  ['Manon', 'Fabre', 2, 1340, 2680],
  ['Louis', 'Petit', 3, 1300, 2640],
  ['Sarah', 'Morel', 2, 1280, 2590],
  ['Tom', 'Girard', 1, 1260, 2540],
  ['Emma', 'Roux', 3, 1250, 2510],
  ['Lucas', 'André', 1, 1240, 2490],
  ['Jade', 'Henry', 2, 1235, 2465],
  ['Oscar', 'Lescot', 2, 1240, 2450],
  ['Enzo', 'Lopez', 2, 1200, 2420],
  ['Inès', 'Robin', 2, 1100, 2210],
  ['Théo', 'Blanc', 3, 1050, 2150],
  ['Chloé', 'Martin', 1, 980, 2080],
];

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Jeu de données SQL partagé par les défis de bases de données
const SHOP_SETUP = `
CREATE TABLE clients (id INTEGER PRIMARY KEY, nom TEXT, ville TEXT);
CREATE TABLE commandes (id INTEGER PRIMARY KEY, client_id INTEGER, montant REAL, date_commande TEXT);
INSERT INTO clients VALUES (1,'Alice','Amiens'),(2,'Bob','Paris'),(3,'Chloé','Amiens'),(4,'David','Lille');
INSERT INTO commandes VALUES (1,1,45.0,'2026-01-10'),(2,1,20.0,'2026-02-02'),(3,2,99.9,'2026-02-14'),(4,3,12.5,'2026-03-01');
`.trim();

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // Compétences
  const comp: Record<string, number> = {};
  for (const c of competences) {
    const row = await prisma.competence.upsert({ where: { name: c.name }, update: c, create: c });
    comp[c.name] = row.id;
  }

  // Badges
  for (const b of badges) {
    await prisma.badge.upsert({ where: { slug: b.slug }, update: b, create: b });
  }

  // Enseignante
  const teacher = await prisma.user.upsert({
    where: { email: 'm.dupuis@iut.example' },
    update: {},
    create: {
      email: 'm.dupuis@iut.example',
      passwordHash,
      role: 'TEACHER',
      firstName: 'Marie',
      lastName: 'Dupuis',
      pseudo: 'mme-dupuis',
    },
  });

  // Groupes
  const groups: Record<number, number> = {};
  for (const n of [1, 2, 3]) {
    const g = await prisma.group.upsert({
      where: { promo_name: { promo: 'BUT 2', name: `BUT 2 · Groupe ${n}` } },
      update: { teacherId: teacher.id },
      create: { name: `BUT 2 · Groupe ${n}`, promo: 'BUT 2', teacherId: teacher.id },
    });
    groups[n] = g.id;
  }

  // Étudiants
  for (const [firstName, lastName, g, xp, points] of students) {
    const email = `${slug(firstName)}.${slug(lastName)}@etu.example`;
    await prisma.user.upsert({
      where: { email },
      update: { xp, points },
      create: {
        email,
        passwordHash,
        role: 'STUDENT',
        firstName,
        lastName,
        pseudo: `${slug(firstName)}${slug(lastName).slice(0, 1)}`,
        groupId: groups[g],
        xp,
        points,
      },
    });
  }

  // Défis
  const challenges = [
    {
      title: 'Sélections simples',
      statement: 'Affiche le nom des clients qui habitent à **Amiens**, triés par nom.',
      type: 'SQL', subject: 'DATABASES', difficulty: 'EASY', minutes: 15, basePoints: 40,
      setupSql: SHOP_SETUP,
      solutionSql: "SELECT nom FROM clients WHERE ville = 'Amiens' ORDER BY nom;",
      starterCode: 'SELECT ',
      competence: 'Gérer les données de l’information',
    },
    {
      title: 'Jointures et sous-requêtes',
      statement: 'Affiche chaque client avec le **total** de ses commandes (les clients sans commande n’apparaissent pas).',
      type: 'SQL', subject: 'DATABASES', difficulty: 'MEDIUM', minutes: 25, basePoints: 80,
      setupSql: SHOP_SETUP,
      solutionSql: 'SELECT c.nom, SUM(o.montant) AS total FROM clients c JOIN commandes o ON o.client_id = c.id GROUP BY c.id, c.nom;',
      starterCode: 'SELECT ',
      competence: 'Gérer les données de l’information',
    },
    {
      title: 'Agrégats et GROUP BY',
      statement: 'Pour chaque ville, donne le **nombre de clients**.',
      type: 'SQL', subject: 'DATABASES', difficulty: 'MEDIUM', minutes: 20, basePoints: 60,
      setupSql: SHOP_SETUP,
      solutionSql: 'SELECT ville, COUNT(*) AS nb FROM clients GROUP BY ville;',
      starterCode: 'SELECT ',
      competence: 'Gérer les données de l’information',
    },
    {
      title: "Tri d'un tableau",
      statement: 'Écris une fonction `trier(tab)` qui trie une liste d’entiers **sans utiliser** `sorted()`.',
      type: 'ALGO', subject: 'ALGORITHMICS', difficulty: 'EASY', minutes: 20, basePoints: 40,
      starterCode: 'def trier(tab):\n    pass\n',
      competence: 'Réaliser un développement d’application',
      tests: [
        { label: 'Liste désordonnée', input: '[3,1,2]', expected: '[1,2,3]' },
        { label: 'Liste vide', input: '[]', expected: '[]' },
        { label: 'Doublons', input: '[2,2,1]', expected: '[1,2,2]' },
        { label: 'Déjà triée', input: '[1,2,3]', expected: '[1,2,3]', hidden: true },
      ],
    },
    {
      title: 'Formulaire responsive',
      statement: 'Construis un formulaire de contact accessible qui s’adapte aux petits écrans.',
      type: 'WEB', subject: 'WEB_DEV', difficulty: 'HARD', minutes: 45, basePoints: 120,
      competence: 'Réaliser un développement d’application',
    },
    {
      title: 'Sous-réseaux IPv4',
      statement: 'Découpe le réseau `192.168.1.0/24` en 4 sous-réseaux égaux.',
      type: 'NETWORK', subject: 'NETWORKS_SYSTEMS', difficulty: 'MEDIUM', minutes: 30, basePoints: 110,
      competence: 'Administrer des systèmes d’information',
    },
  ] as const;

  for (const c of challenges) {
    const { competence, ...data } = c;
    const tests = 'tests' in c ? c.tests : [];
    const existing = await prisma.challenge.findFirst({ where: { title: data.title } });
    if (existing) continue; // pas de doublon au second lancement
    await prisma.challenge.create({
      data: {
        ...data,
        published: true,
        authorId: teacher.id,
        competences: { create: { competenceId: comp[competence] } },
        tests: { create: tests.map((t, i) => ({ ...t, position: i })) },
      },
    });
  }

  // Administrateur
  await prisma.user.upsert({
    where: { email: 'admin.dsi@iut.example' },
    update: {},
    create: { email: 'admin.dsi@iut.example', passwordHash, role: 'ADMIN', firstName: 'Service', lastName: 'DSI', pseudo: 'admin-dsi' },
  });

  // Activité de démonstration pour Oscar (une seule fois) : points des 7 derniers jours et badges
  const oscar = await prisma.user.findUnique({ where: { email: 'oscar.lescot@etu.example' } });
  if (oscar && (await prisma.pointEvent.count({ where: { userId: oscar.id } })) === 0) {
    const perDay = [0, 0, 50, 60, 120, 90, 60]; // du plus ancien (J-6) à aujourd'hui
    const events = perDay.flatMap((points, i) => {
      if (points === 0) return [];
      const at = new Date(Date.now() - (6 - i) * 86_400_000);
      at.setHours(12, 0, 0, 0);
      if (at.getTime() > Date.now()) at.setTime(Date.now() - 60_000);
      return [{ userId: oscar.id, points, xp: points, reason: 'demo', createdAt: at }];
    });
    await prisma.pointEvent.createMany({ data: events });
    for (const slugName of ['premier-pas', 'sql-master', 'serie-5-jours', 'top-10-promo']) {
      const badge = await prisma.badge.findUnique({ where: { slug: slugName } });
      if (badge) {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId: oscar.id, badgeId: badge.id } },
          update: {},
          create: { userId: oscar.id, badgeId: badge.id },
        });
      }
    }
    await prisma.user.update({ where: { id: oscar.id }, data: { streakDays: 5, lastActiveDay: new Date() } });
  }

  const [users, chals] = await Promise.all([prisma.user.count(), prisma.challenge.count()]);
  console.log(`✔ Seed terminé : ${users} utilisateurs, ${chals} défis, ${badges.length} badges.`);
  console.log(`  Connexion de test : <prénom>.<nom>@etu.example / ${process.env.SEED_PASSWORD ? '(SEED_PASSWORD)' : PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
