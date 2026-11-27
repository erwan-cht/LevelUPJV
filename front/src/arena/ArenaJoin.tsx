import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Swords } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

/** Saisie du code d'une arène (ou arrivée par le QR code : le code est dans l'adresse). */
export default function ArenaJoin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fromLink = (params.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const [code, setCode] = useState(fromLink);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const auto = useRef(false);

  const join = async (value: string) => {
    if (!value || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ code: string }>('/arena/join', { body: { code: value } });
      navigate(`/arene/${res.code}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de rejoindre.');
      setBusy(false);
    }
  };

  // Arrivée par le QR code : on entre directement dans la salle.
  useEffect(() => {
    if (fromLink && !auto.current) {
      auto.current = true;
      void join(fromLink);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void join(code);
  };

  return (
    <div className="mx-auto max-w-md space-y-6 py-10 text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-navy text-white">
        <Swords className="h-8 w-8" />
      </span>
      <div>
        <h1 className="text-3xl font-bold">Rejoindre une arène</h1>
        <p className="mt-1 text-sm text-muted">Saisis le code affiché au tableau, ou scanne le QR code.</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label htmlFor="code" className="sr-only">
          Code de l’arène
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          maxLength={8}
          placeholder="ABCDE"
          className="w-full rounded-xl border-2 border-slate-300 bg-white py-4 text-center text-4xl font-black uppercase tracking-[0.4em] focus:border-brand focus:outline-none"
        />
        {error && (
          <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !code} className="h-14 w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-50">
          {busy ? 'Connexion…' : 'Rejoindre'}
        </button>
      </form>
    </div>
  );
}
