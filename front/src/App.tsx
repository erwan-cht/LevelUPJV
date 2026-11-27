import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout, StudentLayout, TeacherLayout } from './components/layout/Layouts';
import Comptes from './pages/admin/Comptes';
import Contenus from './pages/admin/Contenus';
import Promotions from './pages/admin/Promotions';
import Referentiel from './pages/admin/Referentiel';
import ArenaHost from './arena/ArenaHost';
import ArenaJoin from './arena/ArenaJoin';
import ArenaLauncher from './arena/ArenaLauncher';
import ArenaPlay from './arena/ArenaPlay';
import Assistant from './pages/Assistant';
import Classement from './pages/Classement';
import ArbreCompetences from './pages/Competences';
import Connexion from './pages/Connexion';
import Dashboard from './pages/Dashboard';
import DefiDetail from './pages/DefiDetail';
import Defis from './pages/Defis';
import DuelLive from './pages/DuelLive';
import Duels from './pages/Duels';
import MotDePasse from './pages/MotDePasse';
import MotDePasseOublie from './pages/MotDePasseOublie';
import Parametres from './pages/Parametres';
import Profil from './pages/Profil';
import Quiz from './pages/Quiz';
import Succes from './pages/Succes';
import Aide from './pages/teacher/Aide';
import Competences from './pages/teacher/Competences';
import CreerDefi from './pages/teacher/CreerDefi';
import MesPromos from './pages/teacher/MesPromos';

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />

      <Route element={<StudentLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="defis" element={<Defis />} />
        <Route path="defis/:id" element={<DefiDetail />} />
        <Route path="classement" element={<Classement />} />
        <Route path="duels" element={<Duels />} />
        <Route path="duels/:id" element={<DuelLive />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="arene" element={<ArenaJoin />} />
        <Route path="arene/:code" element={<ArenaPlay />} />
        <Route path="competences" element={<ArbreCompetences />} />
        <Route path="profil" element={<Profil />} />
        <Route path="succes" element={<Succes />} />
        <Route path="parametres" element={<Parametres />} />
        <Route path="parametres/mot-de-passe" element={<MotDePasse />} />
      </Route>

      <Route path="enseignant" element={<TeacherLayout />}>
        <Route index element={<MesPromos />} />
        <Route path="challenges" element={<CreerDefi />} />
        <Route path="arene" element={<ArenaLauncher />} />
        <Route path="arene/:code" element={<ArenaHost />} />
        <Route path="competences" element={<Competences />} />
        <Route path="aide" element={<Aide />} />
        <Route path="parametres" element={<Parametres />} />
        <Route path="parametres/mot-de-passe" element={<MotDePasse />} />
      </Route>

      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Comptes />} />
        <Route path="promotions" element={<Promotions />} />
        <Route path="contenus" element={<Contenus />} />
        <Route path="referentiel" element={<Referentiel />} />
        <Route path="parametres" element={<Parametres />} />
        <Route path="parametres/mot-de-passe" element={<MotDePasse />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
