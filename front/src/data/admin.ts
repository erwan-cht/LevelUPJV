import type { Competence } from '../types';
import { students } from './community';
import { teacherCompetences } from './teacher';

export type AccountRole = 'etudiant' | 'enseignant' | 'admin';
export type AccountStatus = 'actif' | 'suspendu' | 'en-attente';

export interface Account {
  id: number;
  name: string;
  initials: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  /** Promotion · groupe pour un étudiant, matières suivies pour un enseignant. */
  promo: string;
  lastLogin: string;
  createdAt: string;
}

export interface Promotion {
  id: number;
  name: string;
  year: string;
  groups: string[];
  referent: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  text: string;
}

export const roleLabel: Record<AccountRole, string> = {
  etudiant: 'Étudiant',
  enseignant: 'Enseignant',
  admin: 'Administrateur',
};

export const statusLabel: Record<AccountStatus, string> = {
  actif: 'Actif',
  suspendu: 'Suspendu',
  'en-attente': 'En attente',
};

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const emailOf = (name: string) =>
  `${name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')}@etud.u-picardie.fr`;

const logins = ['Aujourd’hui, 09:12', 'Aujourd’hui, 08:40', 'Hier, 17:55', 'Hier, 14:02', 'Il y a 3 jours', 'Il y a 9 jours'];

const studentAccounts: Account[] = students.map((s, i) => ({
  id: i + 1,
  name: s.name,
  initials: s.initials,
  email: emailOf(s.name),
  role: 'etudiant',
  status: s.name === 'Enzo Lopez' ? 'suspendu' : 'actif',
  promo: s.group,
  lastLogin: s.name === 'Enzo Lopez' ? 'Il y a 12 jours' : logins[i % logins.length]!,
  createdAt: '02/09/2026',
}));

const extra: Omit<Account, 'id'>[] = [
  { name: 'Yanis Blanc', initials: 'YB', email: emailOf('Yanis Blanc'), role: 'etudiant', status: 'actif', promo: 'BUT 1 · Groupe 1', lastLogin: 'Il y a 9 jours', createdAt: '02/09/2026' },
  { name: 'Thomas Roux', initials: 'TR', email: emailOf('Thomas Roux'), role: 'etudiant', status: 'actif', promo: 'BUT 3 · Groupe 1', lastLogin: 'Il y a 12 jours', createdAt: '02/09/2026' },
  { name: 'Alice Vasseur', initials: 'AV', email: emailOf('Alice Vasseur'), role: 'etudiant', status: 'en-attente', promo: 'BUT 1 · Groupe 2', lastLogin: 'Jamais', createdAt: '10/11/2026' },
  { name: 'Rayan Caron', initials: 'RC', email: emailOf('Rayan Caron'), role: 'etudiant', status: 'en-attente', promo: 'BUT 1 · Groupe 2', lastLogin: 'Jamais', createdAt: '12/11/2026' },
  { name: 'Marie Dupuis', initials: 'MD', email: 'marie.dupuis@u-picardie.fr', role: 'enseignant', status: 'actif', promo: 'Bases de données, Web', lastLogin: 'Aujourd’hui, 08:05', createdAt: '28/08/2026' },
  { name: 'Julien Loge', initials: 'JL', email: 'julien.loge@u-picardie.fr', role: 'enseignant', status: 'actif', promo: 'Algorithmique', lastLogin: 'Hier, 18:20', createdAt: '28/08/2026' },
  { name: 'Karim Haddad', initials: 'KH', email: 'karim.haddad@u-picardie.fr', role: 'enseignant', status: 'actif', promo: 'Réseaux & systèmes', lastLogin: 'Il y a 3 jours', createdAt: '01/09/2026' },
  { name: 'Service DSI', initials: 'SD', email: 'dsi-levelup@u-picardie.fr', role: 'admin', status: 'actif', promo: '—', lastLogin: 'Aujourd’hui, 07:30', createdAt: '20/08/2026' },
];

export const initialAccounts: Account[] = [
  ...studentAccounts,
  ...extra.map((a, i) => ({ ...a, id: studentAccounts.length + i + 1 })),
];

export const initialPromotions: Promotion[] = [
  { id: 1, name: 'BUT 1 Informatique', year: '2026-2027', groups: ['Groupe 1', 'Groupe 2', 'Groupe 3'], referent: 'Karim Haddad' },
  { id: 2, name: 'BUT 2 Informatique', year: '2026-2027', groups: ['Groupe 1', 'Groupe 2', 'Groupe 3'], referent: 'Marie Dupuis' },
  { id: 3, name: 'BUT 3 Informatique', year: '2026-2027', groups: ['Groupe 1', 'Groupe 2'], referent: 'Julien Loge' },
];

/** « BUT 2 Informatique » + « Groupe 1 » → « BUT 2 · Groupe 1 » (format utilisé sur les comptes). */
export const promoKey = (promoName: string, group: string) => `${promoName.replace(/ Informatique$/, '')} · ${group}`;

export const initialCompetences: Competence[] = teacherCompetences.map((c) => ({ ...c }));

export const initialAudit: AuditEntry[] = [
  { id: 3, at: 'Aujourd’hui, 09:02', text: 'Compte de Rayan Caron créé (import ENT)' },
  { id: 2, at: 'Hier, 16:48', text: 'Compte d’Enzo Lopez suspendu' },
  { id: 1, at: 'Hier, 10:15', text: 'Défi « Requêtes imbriquées » publié' },
];
