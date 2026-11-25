import { useState, type FormEvent } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Logo from '../components/layout/Logo';
import { buttonBrand, inputClass } from '../components/ui';

/** Page publique « Mot de passe oublié » : la demande est transmise à un administrateur. */
export default function MotDePasseOublie() {
  const [identifiant, setIdentifiant] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifiant.trim()) return setError('Renseigne ton identifiant ou ton e-mail.');
    setBusy(true);
    setError(null);
    try {
      await api('/auth/forgot', { body: { identifiant } });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Logo to="/connexion" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-10">
        <section className="w-full max-w-md rounded-lg bg-panel p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white">
            <KeyRound className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">Mot de passe oublié</h1>

          {sent ? (
            <div role="status" className="mt-4 space-y-3">
              <p className="flex items-start gap-2 rounded-md bg-green-100 px-3 py-3 text-sm text-green-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Demande envoyée. Si ce compte existe, un administrateur va la traiter.
              </p>
              <p className="text-sm text-muted">
                Rapproche-toi de ton enseignant référent ou du service DSI : il te remettra un mot de passe provisoire.
                Après ta connexion, change-le depuis tes paramètres.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                Indique ton identifiant ou ton e-mail. Ta demande est transmise à un administrateur, qui te remettra un
                mot de passe provisoire.
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
                {error && (
                  <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-700">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={busy} className={`${buttonBrand} w-full py-2.5`}>
                  {busy ? 'Envoi…' : 'Envoyer la demande'}
                </button>
              </form>
            </>
          )}

          <Link to="/connexion" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            <ArrowLeft className="h-4 w-4" /> Retour à la connexion
          </Link>
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
