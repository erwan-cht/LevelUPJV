import type { CatalogChallenge, Subject } from '../types';

export const subjectStyles: Record<
  Subject,
  { short: string; bar: string; text: string; border: string; soft: string; dot: string }
> = {
  'Bases de données': { short: 'BDD', bar: 'bg-sky-600', text: 'text-sky-700', border: 'border-sky-600', soft: 'bg-sky-100', dot: 'bg-sky-600' },
  Algorithmique: { short: 'ALGO', bar: 'bg-brand', text: 'text-brand', border: 'border-brand', soft: 'bg-brand-light', dot: 'bg-brand' },
  'Développement web': { short: 'WEB', bar: 'bg-navy', text: 'text-navy', border: 'border-navy', soft: 'bg-slate-200', dot: 'bg-navy' },
  'Réseaux & systèmes': { short: 'RÉSEAUX', bar: 'bg-red-600', text: 'text-red-600', border: 'border-red-600', soft: 'bg-red-100', dot: 'bg-red-600' },
};

export const subjects = Object.keys(subjectStyles) as Subject[];

export const subjectCompetence: Record<Subject, string> = {
  'Bases de données': 'Gérer les données de l’information',
  Algorithmique: 'Réaliser un développement d’application',
  'Développement web': 'Réaliser un développement d’application',
  'Réseaux & systèmes': 'Administrer des systèmes d’information',
};

type Row = [
  title: string,
  difficulty: CatalogChallenge['difficulty'],
  minutes: number,
  points: number,
  description: string,
  status: CatalogChallenge['status'],
  progress?: number,
  recommended?: boolean,
  favorite?: boolean,
];

const rows: Record<Subject, Row[]> = {
  'Bases de données': [
    ['Requêtes imbriquées', 'Moyen', 30, 70, 'Comprendre les sous-requêtes IN, EXISTS et ALL.', 'nouveau', undefined, true],
    ['Jointures et sous-requêtes', 'Moyen', 25, 80, 'Combiner plusieurs tables avec JOIN et filtrer les résultats.', 'en-cours', 60, false, true],
    ['Agrégats et GROUP BY', 'Moyen', 20, 60, 'COUNT, SUM, AVG et regroupements.', 'nouveau'],
    ['Modélisation MCD', 'Moyen', 35, 70, 'Passer du besoin au modèle conceptuel de données.', 'nouveau'],
    ['Vues et index', 'Difficile', 40, 100, 'Optimiser et sécuriser l’accès aux données.', 'nouveau'],
    ['Sélections simples', 'Facile', 15, 40, 'SELECT, WHERE et ORDER BY pour démarrer.', 'termine'],
  ],
  Algorithmique: [
    ['Récursivité : la factorielle', 'Facile', 20, 45, 'Découvrir les appels récursifs et le cas de base.', 'nouveau', undefined, true],
    ["Tri d'un tableau", 'Facile', 20, 40, 'Écrire un tri sans utiliser sorted().', 'nouveau', undefined, false, true],
    ['Recherche dichotomique', 'Facile', 15, 40, 'Chercher efficacement dans une liste triée.', 'nouveau'],
    ['Piles et files', 'Moyen', 30, 60, 'Implémenter les structures LIFO et FIFO.', 'nouveau'],
    ['Complexité algorithmique', 'Moyen', 25, 60, 'Comparer des algorithmes selon leur coût.', 'nouveau'],
    ['Graphes : parcours', 'Difficile', 45, 120, 'Parcours en largeur et en profondeur.', 'nouveau'],
  ],
  'Développement web': [
    ['Formulaire responsive', 'Difficile', 45, 120, 'Construire un formulaire accessible et adaptatif.', 'en-cours', 25, false, true],
    ['DOM et événements', 'Moyen', 30, 70, 'Manipuler le DOM en réagissant aux actions.', 'nouveau'],
    ['API REST', 'Moyen', 40, 100, 'Consommer et exposer une API JSON.', 'nouveau'],
    ['Sessions PHP', 'Moyen', 30, 80, 'Gérer connexion et sessions côté serveur.', 'nouveau'],
    ['Accessibilité', 'Moyen', 25, 60, 'Rendre une page lisible pour tous.', 'nouveau'],
    ['Flexbox et Grid', 'Facile', 20, 50, 'Composer des mises en page modernes.', 'termine'],
  ],
  'Réseaux & systèmes': [
    ['Sous-réseaux IPv4', 'Moyen', 30, 110, 'Découper un réseau avec les masques.', 'nouveau', undefined, true],
    ['Adressage IPv4', 'Facile', 20, 50, 'Classes, masques et adresses privées.', 'nouveau'],
    ['Scripts Bash', 'Moyen', 30, 80, 'Automatiser des tâches avec des scripts.', 'nouveau'],
    ['Droits et permissions', 'Moyen', 25, 70, 'Maîtriser chmod, chown et les ACL.', 'nouveau'],
    ['Docker : premier pas', 'Difficile', 40, 110, 'Lancer et configurer un conteneur.', 'nouveau'],
    ['Commandes Linux', 'Facile', 15, 30, 'Se repérer et agir dans un terminal.', 'termine'],
  ],
};

let nextId = 1;
export const catalog: CatalogChallenge[] = subjects.flatMap((subject) =>
  rows[subject].map(([title, difficulty, minutes, points, description, status, progress, recommended, favorite]) => ({
    id: nextId++,
    title,
    subject,
    difficulty,
    minutes,
    points,
    description,
    tests: 5,
    status,
    progress,
    testsPassed: progress ? Math.round((progress / 100) * 5) : undefined,
    recommended,
    favorite,
  })),
);

/** Détail du défi SQL ouvert depuis le catalogue (jeu de données fictif). */
export const sqlChallenge = {
  statement:
    'Affichez le nom de chaque client ayant passé au moins 2 commandes de plus de 50 €, avec le nombre de ses commandes.',
  order: 'Triez le résultat par nombre de commandes décroissant.',
  note: 'Une seule requête SELECT. Ton résultat est comparé automatiquement au résultat attendu.',
  tables: [
    {
      name: 'clients',
      columns: ['id', 'nom', 'ville'],
      rows: [['1', 'Dupont', 'Amiens'], ['2', 'Martin', 'Albert'], ['3', 'Bernard', 'Abbeville']],
    },
    {
      name: 'commandes',
      columns: ['id', 'client_id', 'montant'],
      rows: [['101', '1', '120.00'], ['102', '1', '75.50'], ['103', '2', '60.00']],
    },
  ],
  initialQuery: `SELECT c.nom, COUNT(o.id) AS nb_commandes
FROM clients c
JOIN commandes o ON o.client_id = c.id
WHERE o.montant > 50
GROUP BY c.nom
HAVING COUNT(o.id) >= 2
ORDER BY nb_commandes DESC;`,
  expected: { columns: ['nom', 'nb_commandes'], rows: [['Dupont', '3'], ['Martin', '2'], ['Bernard', '2']] },
  obtained: { columns: ['nom', 'nb_commandes'], rows: [['Dupont', '3'], ['Martin', '2']] },
  hints: [
    { title: 'Indice 1', cost: 0, text: 'Pense à l’ordre d’exécution : WHERE filtre les lignes avant que GROUP BY ne les regroupe.' },
    { title: 'Indice 2', cost: 10, text: 'Pour filtrer sur le résultat d’un COUNT, il te faut une clause différente de WHERE.' },
    { title: 'Indice 3', cost: 20, text: 'Une comparaison avec un agrégat se place après le GROUP BY. Vérifie aussi l’opérateur (>= ou >).' },
  ],
};
