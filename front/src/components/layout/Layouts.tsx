import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { homeFor, useAuth } from '../../auth';
import { AdminProvider } from '../../pages/admin/store';
import { MeProvider, useMe } from '../../me';
import Header, { studentNav, type NavItem } from '../Header';
import { formatNumber } from '../ui';
import Footer from './Footer';

/** Cadre commun : en-tête, contenu de la page, pied de page. */
function Shell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {header}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <Footer />
    </div>
  );
}

/** En-tête de l'espace étudiant : affiche les points réels de l'étudiant connecté. */
function StudentShell() {
  const { me } = useMe();
  return (
    <Shell header={<Header links={studentNav} chip={me ? `${formatNumber(me.points)} pts` : '… pts'} profilePath="/profil" />}>
      <Outlet />
    </Shell>
  );
}

/** Espace étudiant : redirige vers la connexion sans jeton, et vers l'accueil du bon rôle sinon. */
export function StudentLayout() {
  const { role } = useAuth();
  if (!role) return <Navigate to="/connexion" replace />;
  if (role !== 'etudiant') return <Navigate to={homeFor(role)} replace />;

  return (
    <MeProvider>
      <StudentShell />
    </MeProvider>
  );
}

const teacherNav: NavItem[] = [
  { label: 'Mes promos', to: '/enseignant', end: true },
  { label: 'Challenges', to: '/enseignant/challenges' },
  { label: 'Compétences', to: '/enseignant/competences' },
  { label: 'Aide', to: '/enseignant/aide' },
];

function TeacherShell() {
  const { me } = useMe();
  return (
    <Shell header={<Header links={teacherNav} chip={me?.shortName ?? '…'} badge="Enseignant" home="/enseignant" />}>
      <Outlet />
    </Shell>
  );
}

/** Espace enseignant : navigation dédiée, réservé au rôle enseignant. */
export function TeacherLayout() {
  const { role } = useAuth();
  if (!role) return <Navigate to="/connexion" replace />;
  if (role !== 'enseignant') return <Navigate to={homeFor(role)} replace />;

  return (
    <MeProvider>
      <TeacherShell />
    </MeProvider>
  );
}

const adminNav: NavItem[] = [
  { label: 'Comptes', to: '/admin', end: true },
  { label: 'Promotions', to: '/admin/promotions' },
  { label: 'Contenus', to: '/admin/contenus' },
  { label: 'Référentiel', to: '/admin/referentiel' },
];

function AdminShell() {
  const { me } = useMe();
  return (
    <Shell header={<Header links={adminNav} chip={me ? `${me.firstName} ${me.lastName}` : '…'} badge="Admin" home="/admin" />}>
      <AdminProvider>
        <Outlet />
      </AdminProvider>
    </Shell>
  );
}

/** Espace administrateur : gestion des comptes, promotions, contenus et référentiel. */
export function AdminLayout() {
  const { role } = useAuth();
  if (!role) return <Navigate to="/connexion" replace />;
  if (role !== 'admin') return <Navigate to={homeFor(role)} replace />;

  return (
    <MeProvider>
      <AdminShell />
    </MeProvider>
  );
}
