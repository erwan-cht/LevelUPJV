import type { Achievement, DuelTest, HistoryEntry, Opponent, Student, Subject } from '../types';

// nom, initiales, groupe, niveau, défis, points, évolution
const rawStudents: [string, string, string, number, number, number, number][] = [
  ['Léa Marchand', 'LM', 'BUT 2 · Groupe 2', 9, 61, 3120, 1],
  ['Hugo Bernard', 'HB', 'BUT 2 · Groupe 1', 8, 58, 2980, 0],
  ['Camille Dubois', 'CD', 'BUT 2 · Groupe 3', 8, 55, 2760, -1],
  ['Nathan Leroy', 'NL', 'BUT 2 · Groupe 1', 8, 52, 2710, 2],
  ['Manon Fabre', 'MF', 'BUT 2 · Groupe 2', 8, 51, 2680, 0],
  ['Louis Petit', 'LP', 'BUT 2 · Groupe 3', 7, 49, 2640, 1],
  ['Sarah Morel', 'SM', 'BUT 2 · Groupe 2', 7, 48, 2590, -2],
  ['Tom Girard', 'TG', 'BUT 2 · Groupe 1', 7, 47, 2540, 0],
  ['Emma Roux', 'ER', 'BUT 2 · Groupe 3', 7, 46, 2510, 3],
  ['Lucas André', 'LA', 'BUT 2 · Groupe 1', 7, 45, 2490, -1],
  ['Jade Henry', 'JH', 'BUT 2 · Groupe 2', 7, 44, 2465, -1],
  ['Oscar Lescot', 'OL', 'BUT 2 · Groupe 2', 7, 43, 2450, 2],
  ['Enzo Lopez', 'EL', 'BUT 2 · Groupe 2', 7, 42, 2420, 0],
  ['Inès Robin', 'IR', 'BUT 2 · Groupe 2', 6, 40, 2210, 0],
  ['Théo Blanc', 'TB', 'BUT 2 · Groupe 3', 6, 38, 2150, 1],
  ['Chloé Martin', 'CM', 'BUT 2 · Groupe 1', 6, 36, 2080, -1],
];

export const students: Student[] = rawStudents.map(([name, initials, group, level, challenges, points, delta], i) => ({
  rank: i + 1,
  name,
  initials,
  group,
  level,
  challenges,
  points,
  delta,
  isMe: initials === 'OL',
}));

export const leagues = [
  { name: 'Diamant', min: 5000, color: 'bg-sky-300' },
  { name: 'Platine', min: 4000, color: 'bg-slate-300' },
  { name: 'Or', min: 3000, color: 'bg-yellow-400' },
  { name: 'Argent', min: 2000, color: 'bg-slate-400' },
  { name: 'Bronze', min: 0, color: 'bg-amber-700' },
];

export const weeklyPoints = [
  { label: 'S1', points: 180 },
  { label: 'S2', points: 240 },
  { label: 'S3', points: 150 },
  { label: 'S4', points: 320 },
  { label: 'S5', points: 280 },
  { label: 'S6', points: 410 },
];

// ---------- Duels ----------
export const opponents: Opponent[] = [
  { name: 'Léa Marchand', initials: 'LM', level: 9, league: 'Ligue Or', status: 'dispo' },
  { name: 'Hugo Bernard', initials: 'HB', level: 8, league: 'Ligue Argent', status: 'dispo' },
  { name: 'Camille Dubois', initials: 'CD', level: 8, league: 'Ligue Argent', status: 'dispo' },
  { name: 'Nathan Leroy', initials: 'NL', level: 8, league: 'Ligue Argent', status: 'en-duel' },
  { name: 'Manon Fabre', initials: 'MF', level: 7, league: 'Ligue Argent', status: 'en-duel' },
];

export const duelTests: DuelTest[] = [
  { label: 'Liste vide', expected: '[] → []', passed: true },
  { label: 'Un seul élément', expected: '[7] → [7]', passed: true },
  { label: 'Liste déjà triée', expected: '[1, 2, 3] → [1, 2, 3]', passed: true },
  { label: 'Liste inversée', expected: '[3, 2, 1] → [1, 2, 3]', passed: false },
  { label: 'Doublons et négatifs', expected: '[2, -1, 2, 0] → [-1, 0, 2, 2]', passed: false },
];

export const duelFeed = [
  { time: '00:00', who: '', text: 'Le duel a commencé.' },
  { time: '00:41', who: 'Léa', text: 'a réussi le test 1.' },
  { time: '01:05', who: 'Vous', text: 'avez réussi le test 1.' },
  { time: '01:52', who: 'Vous', text: 'avez réussi le test 2.' },
  { time: '02:18', who: 'Léa', text: 'a réussi le test 2.' },
  { time: '02:46', who: 'Vous', text: 'avez réussi le test 3.' },
];

export const duelCode = `def tri_croissant(liste):
    resultat = list(liste)
    for i in range(len(resultat)):
        for j in range(0, len(resultat) - i - 1):
            if resultat[j] > resultat[j + 1]:
                resultat[j], resultat[j + 1] = resultat[j + 1], resultat[j]
    return resultat`;

export const recentDuels = [{ result: 'Défaite', opponent: 'Léa M.', subject: 'Algorithmique · Facile', points: 0 }];

export const pendingInvites = [{ name: 'Hugo B.', initials: 'HB', subject: 'Algorithmique', difficulty: 'Moyen' }];

// ---------- Succès et badges ----------
const achievementModels: [string, string, number][] = [
  ['Rookie des défis', 'Terminer 5 défis', 60],
  ['Première série', 'Atteindre une série de 3 jours', 40],
  ['Maître des jointures', 'Réussir 3 défis de jointures', 80],
  ['Algorithmicien', 'Terminer 10 défis d’algorithmique', 100],
  ['Web designer', 'Terminer 5 défis web', 70],
  ['Administrateur', 'Terminer 5 défis réseaux', 70],
  ['Duelliste', 'Gagner son premier duel', 50],
  ['Top 10 promo', 'Entrer dans le top 10 de la promo', 120],
];

export const achievements: Achievement[] = Array.from({ length: 128 }, (_, i) => {
  const [name, description, points] = achievementModels[i % achievementModels.length];
  return { id: i + 1, name, description, points, claimed: i % 5 === 0 };
});

export const profileBadges = [
  { name: 'Premier pas', earned: true },
  { name: 'SQL Master', earned: true },
  { name: 'Série 5 jours', earned: true },
  { name: 'Top 10 promo', earned: true },
  { name: 'Duelliste', earned: false },
  { name: 'Full-stack', earned: false },
  { name: 'Noctambule', earned: false },
  { name: 'Perfectionniste', earned: false },
  { name: 'Marathonien', earned: false },
  { name: 'Mentor', earned: false },
  { name: 'Explorateur', earned: false },
  { name: 'Légende', earned: false },
];

// ---------- Profil ----------
export const subjectProgress: { subject: Subject; done: number; total: number }[] = [
  { subject: 'Bases de données', done: 14, total: 30 },
  { subject: 'Algorithmique', done: 11, total: 30 },
  { subject: 'Développement web', done: 10, total: 30 },
  { subject: 'Réseaux & systèmes', done: 8, total: 30 },
];

export const recentSuccess: HistoryEntry[] = [
  { title: 'Commandes Linux', subject: 'Réseaux & systèmes', date: '08/10', duration: '31 min', points: 30 },
  { title: 'Sélections simples', subject: 'Bases de données', date: '08/10', duration: '8 min', points: 30 },
  { title: 'Flexbox et Grid', subject: 'Développement web', date: '07/10', duration: '21 min', points: 50 },
  { title: 'Boucles et listes', subject: 'Algorithmique', date: '06/10', duration: '15 min', points: 40 },
];

export const fullHistory: HistoryEntry[] = [
  ...recentSuccess,
  { title: 'Piles et files', subject: 'Algorithmique', date: '05/10', duration: '34 min', points: 60 },
  { title: 'Modélisation MCD', subject: 'Bases de données', date: '04/10', duration: '40 min', points: 70 },
  { title: 'Accessibilité', subject: 'Développement web', date: '03/10', duration: '27 min', points: 60 },
  { title: 'Adressage IPv4', subject: 'Réseaux & systèmes', date: '02/10', duration: '18 min', points: 50 },
];

/** Carte de chaleur : 12 semaines × 7 jours, niveau 0 à 4 (valeurs déterministes). */
export const heatmap: number[][] = Array.from({ length: 12 }, (_, w) =>
  Array.from({ length: 7 }, (_, d) => ((w * 7 + d * 3 + ((w * d) % 5)) * 7) % 5),
);

export const competenceSkills = [
  { name: 'Réaliser', value: 72, description: 'Développer des applications informatiques' },
  { name: 'Optimiser', value: 64, description: 'Optimiser des applications' },
  { name: 'Administrer', value: 58, description: 'Administrer des systèmes d’information' },
  { name: 'Gérer', value: 81, description: 'Gérer des données de l’information' },
  { name: 'Conduire', value: 45, description: 'Conduire un projet' },
  { name: 'Collaborer', value: 69, description: 'Collaborer au sein d’une équipe' },
];
