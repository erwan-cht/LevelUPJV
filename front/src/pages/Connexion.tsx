import { useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, Swords, Trophy, Zap } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../auth';
import { ApiError } from '../api';
import Logo from '../components/layout/Logo';
import { buttonBrand, inputClass } from '../components/ui';

const features = [
  { icon: Zap, title: 'Correction automatique', text: 'SQL, algorithmique, web : ta réponse est testée en quelques secondes.' },
  { icon: Trophy, title: 'Points, niveaux et ligues', text: 'Un classement par promo et par groupe pour rester motivé.' },
  { icon: Swords, title: 'Duels en temps réel', text: 'Affronte un camarade sur le même exercice.' },
];

export default function Connexion() {
  const { role: current, login } = useAuth();
  const navigate = useNavigate();
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
      // Le rôle est celui du compte en base : on redirige vers l’espace correspondant.
      const got = await login(id, pwd);
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

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-10">
        <div className="grid w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm lg:grid-cols-2">
        <section className="flex flex-col justify-center bg-navy p-8 text-white lg:p-10">
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

        <section className="flex flex-col justify-center bg-white p-8 lg:p-10">
          <h2 className="text-2xl font-semibold">Connexion</h2>
          <p className="mt-1 text-sm text-muted">
            Content de te revoir. Connecte-toi pour reprendre là où tu t’étais arrêté.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <label className="block text-sm font-medium">
              Identifiant ou e-mail
              <input
                className={`${inputClass} mt-1`}
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                autoComplete="username"
                placeholder="prenom.nom"
              />
            </label>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Mot de passe
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  className={`${inputClass} pr-10`}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  title={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-navy"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Rester connecté
              </label>
              <Link to="/mot-de-passe-oublie" className="font-semibold text-brand hover:underline">
                Mot de passe oublié ?
              </Link>
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

          <p id="aide" className="mt-6 text-xs text-muted">
            Première visite ? Utilise tes identifiants de l’ENT : ton compte LevelUPJV est créé automatiquement.
          </p>
        </section>
        </div>
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
