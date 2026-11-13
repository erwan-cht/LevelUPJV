import type { Competence, Notion, StudentToHelp } from '../types';

export const teacher = { name: 'Mme Dupuis', shortName: 'Mme Dupuis', initials: 'MD' };

export const teacherStats = [
  { label: 'Étudiants actifs', value: '48', suffix: '/ 52', trend: '▲ +3 vs semaine dernière', tone: 'text-green-600', border: 'border-t-sky-600' },
  { label: 'Défis réussis', value: '1 240', suffix: '', trend: '▲ +12 %', tone: 'text-green-600', border: 'border-t-brand' },
  { label: 'Taux de réussite moyen', value: '68', suffix: '%', trend: '▼ -2 pts', tone: 'text-red-600', border: 'border-t-green-600' },
  { label: 'Étudiants en difficulté', value: '7', suffix: '', trend: '▲ +2 à accompagner', tone: 'text-red-600', border: 'border-t-red-600' },
];

export const notions: Notion[] = [
  { title: 'Requêtes imbriquées', subject: 'Bases de données', successRate: 34, attempts: 4.2 },
  { title: 'Jointures externes (LEFT JOIN)', subject: 'Bases de données', successRate: 41, attempts: 3.6 },
  { title: 'Récursivité', subject: 'Algorithmique', successRate: 45, attempts: 3.9 },
  { title: 'Complexité algorithmique', subject: 'Algorithmique', successRate: 52, attempts: 3.1 },
  { title: 'Sessions et cookies PHP', subject: 'Développement web', successRate: 56, attempts: 2.8 },
  { title: 'Sous-réseaux IPv4', subject: 'Réseaux & systèmes', successRate: 58, attempts: 3.3 },
  { title: 'Flexbox et Grid', subject: 'Développement web', successRate: 71, attempts: 1.9 },
  { title: 'Scripts Bash', subject: 'Réseaux & systèmes', successRate: 74, attempts: 2.0 },
  { title: 'Sélections simples', subject: 'Bases de données', successRate: 92, attempts: 1.2 },
];

export const studentsToHelp: StudentToHelp[] = [
  { name: 'Yanis Blanc', initials: 'YB', info: 'Aucune activité depuis 9 jours', tag: 'inactif' },
  { name: 'Enzo Lopez', initials: 'EL', info: '22 % de réussite en bases de données', tag: 'bloqué' },
  { name: 'Jade Henry', initials: 'JH', info: '4 tentatives sur la récursivité', tag: 'à suivre' },
  { name: 'Thomas Roux', initials: 'TR', info: 'Série interrompue il y a 12 jours', tag: 'à suivre' },
];

export const teacherCompetences: Competence[] = [
  { name: 'Réaliser', description: 'Développer des applications informatiques', value: 73 },
  { name: 'Optimiser', description: 'Optimiser des applications', value: 49 },
  { name: 'Administrer', description: 'Administrer des systèmes d’information', value: 61 },
  { name: 'Gérer', description: 'Gérer des données de l’information', value: 58 },
  { name: 'Conduire', description: 'Conduire un projet', value: 66 },
  { name: 'Collaborer', description: 'Collaborer au sein d’une équipe', value: 75 },
];

export const teacherAlert =
  'Les notions Requêtes imbriquées et Jointures externes bloquent la promo : pense à relancer un challenge en TD.';
