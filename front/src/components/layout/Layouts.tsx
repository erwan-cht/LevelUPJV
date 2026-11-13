import { Navigate, Outlet } from 'react-router-dom';
import { homeFor, useAuth } from '../../auth';
import { AdminProvider } from '../../pages/admin/store';
import { currentUser } from '../../data/mock';
import { teacher } from '../../data/teacher';
import Header, { studentNav, type NavItem } from '../Header';
import { formatNumber } from '../ui';
import Footer from './Footer';

/** Espace étudiant : en-tête, contenu, pied de page. Redirige vers la connexion sinon. */
export function StudentLayout() {
  const { role } = useAuth();
  if (!role) return <Navigate to="/connexion" replace />;
  if (role !== 'etudiant') return <Navigate to={homeFor(role)} replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <Header links={studentNav} chip={`${formatNumber(currentUser.points)} pts`} profilePath="/profil" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

const teacherNav: NavItem[] = [
  { label: 'Mes promos', to: '/enseignant', end: true },
  { label: 'Challenges', to: '/enseignant/challenges' },
  { label: 'Compétences', to: '/enseignant/competences' },
  { label: 'Aide', to: '/enseignant/aide' },
];

/** Espace enseignant : navigation dédiée, réservé au rôle enseignant. */
export function TeacherLayout() {
  const { role } = useAuth();
  if (!role) return <Navigate to="/connexion" replace />;
  if (role !== 'enseignant') return <Navigate to={homeFor(role)} replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <Header links={teacherNav} chip={teacher.shortName} badge="Enseignant" home="/enseignant" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

const adminNav: NavItem[] = [
  { label: 'Comptes', to: '/admin', end: true },
  { label: 'Promotions', to: '/admin/promotions' },
  { label: 'Contenus', to: '/admin/contenus' },
  { label: 'Référentiel', to: '/admin/referentiel' },
];

/** Espace administrateur : gestion des comptes, promotions, contenus et référentiel. */
export function AdminLayout() {
  const { role } = useAuth();
  if (!role) return <Navigate to="/connexion" replace />;
  if (role !== 'admin') return <Navigate to={homeFor(role)} replace />;

  return (
    <AdminProvider>
      <div className="flex min-h-screen flex-col">
        <Header links={adminNav} chip="Service DSI" badge="Admin" home="/admin" />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </AdminProvider>
  );
}
