import { useRef, useState, type ChangeEvent } from 'react';
import { Lock, User as UserIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatLongDate } from '../format';
import { useMe } from '../me';
import type { ApiUser } from '../types';
import { Breadcrumb, Card, CardTitle, PageTitle, Toggle, buttonOutline } from '../components/ui';

const roles = { STUDENT: 'Étudiant', TEACHER: 'Enseignant', ADMIN: 'Administrateur' } as const;

/** Paramètres du compte : informations, photo, mot de passe et (pour les étudiants) confidentialité. */
export default function Parametres() {
  const { me } = useMe();
  if (!me) {
    return <p role="status" className="rounded-lg bg-panel p-6 text-center text-sm text-muted">Chargement…</p>;
  }
  const home = me.role === 'TEACHER' ? '/enseignant' : me.role === 'ADMIN' ? '/admin' : '/';

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: home }, { label: 'Paramètres' }]} />
      <PageTitle title="Paramètres" subtitle="Gère ton compte : photo, mot de passe et confidentialité." />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <AccountCard me={me} />
        <PhotoCard me={me} />
        <PasswordLinkCard />
        {me.role === 'STUDENT' && <PrivacyCard me={me} />}
      </div>
    </div>
  );
}

function AccountCard({ me }: { me: ApiUser }) {
  const rows: [string, string][] = [
    ['Nom', `${me.firstName} ${me.lastName}`],
    ['E-mail', me.email],
    ['Profil', roles[me.role]],
    ...(me.role === 'STUDENT' ? ([['Promotion', me.group ?? me.formation]] as [string, string][]) : []),
    ['Membre depuis', formatLongDate(me.memberSince)],
  ];
  return (
    <Card>
      <CardTitle>Mon compte</CardTitle>
      <dl className="mt-3 space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-muted">Pour changer ton nom ou ton e-mail, contacte un administrateur.</p>
    </Card>
  );
}

function PhotoCard({ me }: { me: ApiUser }) {
  const { refreshMe } = useMe();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  /** Envoie la photo choisie (recadrée et réduite à 128 px dans le navigateur). */
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setResult(null);
    if (!file.type.startsWith('image/')) return setResult({ ok: false, text: 'Choisis un fichier image (JPEG, PNG ou WebP).' });
    setBusy(true);
    try {
      await api('/me/avatar', { method: 'PUT', body: { image: await toAvatar(file) } });
      refreshMe();
      setResult({ ok: true, text: 'Photo enregistrée.' });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Impossible d’enregistrer la photo.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setResult(null);
    try {
      await api('/me/avatar', { method: 'DELETE' });
      refreshMe();
      setResult({ ok: true, text: 'Photo retirée.' });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Impossible de retirer la photo.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle>Photo de profil</CardTitle>
      <div className="mt-3 flex items-center gap-4">
        <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy text-white">
          {me.avatarUrl ? <img src={me.avatarUrl} alt="Ta photo de profil" className="h-full w-full object-cover" /> : <UserIcon className="h-12 w-12" />}
        </span>
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="Choisir une photo de profil" onChange={pick} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={buttonOutline}>
              {me.avatarUrl ? 'Changer la photo' : 'Choisir une photo'}
            </button>
            {me.avatarUrl && (
              <button type="button" onClick={remove} disabled={busy} className={`${buttonOutline} border-red-600 text-red-600 hover:bg-red-50`}>
                Retirer
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted">JPEG, PNG ou WebP. La photo est recadrée au carré et réduite avant l’envoi.</p>
        </div>
      </div>
      {result && (
        <p role={result.ok ? 'status' : 'alert'} className={`mt-3 rounded px-3 py-2 text-xs ${result.ok ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {result.text}
        </p>
      )}
    </Card>
  );
}

/** Le changement de mot de passe se fait sur une page dédiée : on y accède depuis cette carte. */
function PasswordLinkCard() {
  return (
    <Card>
      <CardTitle>Mot de passe</CardTitle>
      <p className="mt-3 text-sm text-muted">
        Change ton mot de passe sur une page dédiée. Tu devras saisir ton mot de passe actuel.
      </p>
      <Link to="mot-de-passe" className={`${buttonOutline} mt-4`}>
        <Lock className="h-4 w-4" /> Changer mon mot de passe
      </Link>
    </Card>
  );
}

type Privacy = { showInRanking: boolean; acceptDuels: boolean };

function PrivacyCard({ me }: { me: ApiUser }) {
  const { refreshMe } = useMe();
  const [settings, setSettings] = useState<Privacy>(me.settings);
  const [error, setError] = useState<string | null>(null);

  /** Enregistre une préférence ; en cas d'échec, l'ancienne valeur est rétablie. */
  const change = async (key: keyof Privacy, value: boolean) => {
    const before = settings;
    setError(null);
    setSettings({ ...settings, [key]: value });
    try {
      setSettings(await api<Privacy>('/me/settings', { method: 'PATCH', body: { [key]: value } }));
      refreshMe();
    } catch (e) {
      setSettings(before);
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer la préférence.');
    }
  };

  return (
    <Card>
      <CardTitle>Confidentialité</CardTitle>
      {error && <p role="alert" className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
      <ul className="mt-3 space-y-2">
        <Setting label="Apparaître dans le classement" text="Les autres étudiants voient ton nom et tes points." checked={settings.showInRanking} onChange={(v) => change('showInRanking', v)} />
        <Setting label="Invitations à un duel" text="Autoriser les camarades à te défier." checked={settings.acceptDuels} onChange={(v) => change('acceptDuels', v)} />
      </ul>
    </Card>
  );
}

function Setting({ label, text, checked, onChange }: { label: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[11px] text-muted">{text}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </li>
  );
}

/** Recadre l'image au carré et la réduit à 128 px : la photo reste légère (quelques Ko) avant l'envoi. */
async function toAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Impossible de lire cette image : essaie un autre fichier (JPEG, PNG ou WebP).');
  });
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const side = Math.min(bitmap.width, bitmap.height);
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.85);
}
