import { useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, Swords, Trophy, Zap } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { homeFor, useAuth, type Role } from '../auth';
import { ApiError } from '../api';
import Logo from '../components/layout/Logo';
import { buttonBrand, buttonOutline, inputClass } from '../components/ui';

const features = [
  { icon: Zap, title: 'Correction automatique', text: 'SQL, algorithmique, web : ta réponse est testée en quelques secondes.' },
  { icon: Trophy, title: 'Points, niveaux et ligues', text: 'Un classement par promo et par groupe pour rester motivé.' },
  { icon: Swords, title: 'Duels en temps réel', text: 'Affronte un camarade sur le même exercice.' },
];

export default function Connexion() {
  const { role: current, login, logout } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('etudiant');
  const [identifiant, setIdentifiant] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (current) return <Navigate to={homeFor(current)} replace />;

  const tryLogin = async (id: string, pwd: string) => {
    setError('');
    setBusy(true);
    try {
      const got = await login(id, pwd);
      if (got !== role) {
        logout();
        const label = got === 'enseignant' ? 'Enseignant' : got === 'admin' ? 'Administrateur' : 'Étudiant';
        setError(`Ce compte est un compte ${label.toLowerCase()} : choisis l’onglet « ${label} ».`);
        return;
      }
      navigate(homeFor(got), { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!identifiant.trim() || !password) {
      setError('Renseigne ton identifiant et ton mot de passe.');
      return;
    }
    void tryLogin(identifiant, password);
  };

  // Raccourci de démonstration : compte de test de chaque profil (voir le seed de la base).
  const quickLogin = () => {
    const demo = { etudiant: 'oscar.lescot', enseignant: 'm.dupuis', admin: 'admin.dsi' }[role];
    void tryLogin(demo, 'levelup123');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo to="/connexion" />
          <a href="#aide" className="text-sm text-muted hover:text-brand">
            Besoin d’aide ?
          </a>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-10 lg:grid-cols-2 lg:items-center">
        <section className="rounded-lg bg-navy p-8 text-white">
          <h1 className="text-3xl font-bold leading-tight">
            Entraîne-toi, <span className="text-brand">progresse</span>, grimpe au classement.
          </h1>
          <p className="mt-3 max-w-md text-sm text-slate-300">
            La plateforme de défis pensée par des étudiants du BUT Informatique de l’IUT d’Amiens, alignée sur ce que tu
            vois en cours.
          </p>
          <ul className="mt-8 space-y-5">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-slate-300">{text}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 flex items-start gap-2 border-t border-white/15 pt-5 text-xs text-slate-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            Chaque défi est relié aux compétences du référentiel BUT pour alimenter ton portfolio.
          </p>
        </section>

        <section className="rounded-lg bg-panel p-8">
          <h2 className="text-2xl font-semibold">Connexion</h2>
          <p className="mt-1 text-sm text-muted">
            Content de te revoir. Connecte-toi pour reprendre là où tu t’étais arrêté.
          </p>

          <div className="mt-5 flex rounded-md bg-white p-0.5 text-sm" role="tablist" aria-label="Type de compte">
            {(['etudiant', 'enseignant', 'admin'] as Role[]).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={role === r}
                onClick={() => setRole(r)}
                className={`flex-1 rounded px-3 py-2 font-medium transition-colors ${
                  role === r ? 'bg-navy text-white' : 'hover:bg-slate-100'
                }`}
              >
                {r === 'etudiant' ? 'Étudiant' : r === 'enseignant' ? 'Enseignant' : 'Admin'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <label className="block text-sm font-medium">
              Identifiant ENT
              <input
                className={`${inputClass} mt-1`}
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                autoComplete="username"
                placeholder={role === 'etudiant' ? 'oscar.lescot' : role === 'enseignant' ? 'm.dupuis' : 'admin.dsi'}
              />
            </label>

            <label className="block text-sm font-medium">
              <span className="flex items-center justify-between">
                Mot de passe
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="flex items-center gap-1 text-xs font-normal text-muted hover:text-navy"
                >
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {show ? 'Masquer' : 'Afficher'}
                </button>
              </span>
              <input
                className={`${inputClass} mt-1`}
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Rester connecté
              </label>
              <a href="#aide" className="font-semibold text-brand hover:underline">
                Mot de passe oublié ?
              </a>
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className={`${buttonBrand} w-full py-2.5`}>
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-slate-300" />
            ou
            <span className="h-px flex-1 bg-slate-300" />
          </div>

          <button onClick={quickLogin} disabled={busy} className={`${buttonOutline} w-full`}>
            Se connecter avec le compte UPJV
          </button>

          <p id="aide" className="mt-5 text-xs text-muted">
            Première visite ? Utilise tes identifiants de l’ENT : ton compte LevelUPJV est créé automatiquement.
          </p>
        </section>
      </main>

      <footer className="bg-navy text-xs text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p>LevelUPJV · IUT d’Amiens · BUT Informatique · Mentions légales · Contact</p>
          <p className="text-slate-300">(levelup-01)</p>
        </div>
      </footer>
    </div>
  );
}
