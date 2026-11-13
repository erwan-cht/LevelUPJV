import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout, StudentLayout, TeacherLayout } from './components/layout/Layouts';
import Comptes from './pages/admin/Comptes';
import Contenus from './pages/admin/Contenus';
import Promotions from './pages/admin/Promotions';
import Referentiel from './pages/admin/Referentiel';
import Classement from './pages/Classement';
import Connexion from './pages/Connexion';
import Dashboard from './pages/Dashboard';
import DefiDetail from './pages/DefiDetail';
import Defis from './pages/Defis';
import DuelLive from './pages/DuelLive';
import Duels from './pages/Duels';
import Profil from './pages/Profil';
import Succes from './pages/Succes';
import Aide from './pages/teacher/Aide';
import Competences from './pages/teacher/Competences';
import CreerDefi from './pages/teacher/CreerDefi';
import MesPromos from './pages/teacher/MesPromos';

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />

      <Route element={<StudentLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="defis" element={<Defis />} />
        <Route path="defis/:id" element={<DefiDetail />} />
        <Route path="classement" element={<Classement />} />
        <Route path="duels" element={<Duels />} />
        <Route path="duels/:id" element={<DuelLive />} />
        <Route path="profil" element={<Profil />} />
        <Route path="succes" element={<Succes />} />
      </Route>

      <Route path="enseignant" element={<TeacherLayout />}>
        <Route index element={<MesPromos />} />
        <Route path="challenges" element={<CreerDefi />} />
        <Route path="competences" element={<Competences />} />
        <Route path="aide" element={<Aide />} />
      </Route>

      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Comptes />} />
        <Route path="promotions" element={<Promotions />} />
        <Route path="contenus" element={<Contenus />} />
        <Route path="referentiel" element={<Referentiel />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
