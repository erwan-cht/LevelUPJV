import { useState, type FormEvent } from 'react';
import { ArrowLeft, Check, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useMe } from '../me';
import { Breadcrumb, buttonOutline, buttonPrimary, inputClass } from '../components/ui';

/** Page dédiée au changement de mot de passe (étudiant, enseignant, administrateur). */
export default function MotDePasse() {
  const { me } = useMe();
  const settings = me?.role === 'TEACHER' ? '/enseignant/parametres' : me?.role === 'ADMIN' ? '/admin/parametres' : '/parametres';
  const home = me?.role === 'TEACHER' ? '/enseignant' : me?.role === 'ADMIN' ? '/admin' : '/';

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const rules = [
    { label: '8 caractères minimum', ok: next.length >= 8 },
    { label: 'Différent du mot de passe actuel', ok: next.length > 0 && next !== current },
    { label: 'Confirmation identique', ok: confirm.length > 0 && confirm === next },
  ];
  const ready = current.length > 0 && rules.every((r) => r.ok);
  // Indication de robustesse : longueur et variété de caractères (simple repère, pas une garantie).
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(next)).length;
  const strength = next.length < 8 ? 0 : next.length >= 12 && variety >= 3 ? 3 : variety >= 2 ? 2 : 1;
  const strengthLabel = ['', 'Faible', 'Correct', 'Solide'][strength];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await api('/me/password', { body: { current, next } });
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: home }, { label: 'Paramètres', to: settings }, { label: 'Mot de passe' }]} />

      <section className="mx-auto w-full max-w-md rounded-lg bg-panel p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-white">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Changer mon mot de passe</h1>

        {done ? (
          <div role="status" className="mt-4 space-y-4">
            <p className="flex items-start gap-2 rounded-md bg-green-100 px-3 py-3 text-sm text-green-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Ton mot de passe a bien été modifié. Utilise-le à ta prochaine connexion.
            </p>
            <Link to={settings} className={`${buttonPrimary} w-full`}>
              Retour aux paramètres
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Pour ta sécurité, saisis d’abord ton mot de passe actuel.</p>

            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              <Field label="Mot de passe actuel" value={current} onChange={setCurrent} show={show} autoComplete="current-password" />
              <div>
                <Field label="Nouveau mot de passe" value={next} onChange={setNext} show={show} autoComplete="new-password" />
                {next.length > 0 && (
                  <div className="mt-2" aria-live="polite">
                    <div className="flex gap-1" aria-hidden="true">
                      {[1, 2, 3].map((i) => (
                        <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength ? ['', 'bg-red-500', 'bg-brand', 'bg-green-600'][strength] : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{strengthLabel ? `Robustesse : ${strengthLabel}` : 'Trop court'}</p>
                  </div>
                )}
              </div>
              <Field label="Confirmer le nouveau mot de passe" value={confirm} onChange={setConfirm} show={show} autoComplete="new-password" />

              <button type="button" onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {show ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
              </button>

              <ul className="space-y-1 text-xs">
                {rules.map((r) => (
                  <li key={r.label} className={`flex items-center gap-2 ${r.ok ? 'text-green-700' : 'text-muted'}`}>
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full ${r.ok ? 'bg-green-600 text-white' : 'bg-slate-200'}`}>
                      {r.ok && <Check className="h-3 w-3" />}
                    </span>
                    {r.label}
                  </li>
                ))}
              </ul>

              {error && (
                <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}

              <button type="submit" disabled={!ready || busy} className={`${buttonPrimary} w-full py-2.5`}>
                {busy ? 'Enregistrement…' : 'Modifier mon mot de passe'}
              </button>
            </form>

            <Link to={settings} className={`${buttonOutline} mt-3 w-full`}>
              <ArrowLeft className="h-4 w-4" /> Annuler
            </Link>
          </>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, onChange, show, autoComplete }: { label: string; value: string; onChange: (v: string) => void; show: boolean; autoComplete: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        className={`${inputClass} mt-1`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
