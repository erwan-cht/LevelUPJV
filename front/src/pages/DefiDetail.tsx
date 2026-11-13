import { useState } from 'react';
import { CheckCircle2, Lock, Star, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { catalog, sqlChallenge as sql, subjectCompetence, subjectStyles } from '../data/catalog';
import { Breadcrumb, buttonBrand, buttonOutline, buttonPrimary } from '../components/ui';

type Result = 'idle' | 'running' | 'wrong' | 'ok';

export default function DefiDetail() {
  const { id } = useParams();
  const challenge = catalog.find((c) => c.id === Number(id));

  const [query, setQuery] = useState(sql.initialQuery);
  const [result, setResult] = useState<Result>('wrong');
  const [attempt, setAttempt] = useState(2);
  const [unlocked, setUnlocked] = useState(1);
  const [fav, setFav] = useState(challenge?.favorite ?? false);

  if (!challenge) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Ce défi n’existe pas.</p>
        <Link to="/defis" className={buttonPrimary}>
          Retour aux défis
        </Link>
      </div>
    );
  }

  const st = subjectStyles[challenge.subject];

  const run = (validate: boolean) => {
    setResult('running');
    window.setTimeout(() => {
      // Simulation : la requête passe quand elle utilise >= 2 et pas > 2 sur un agrégat.
      const ok = /where\s+o\.montant\s*>\s*50/i.test(query) === false && /having/i.test(query);
      setResult(validate && ok ? 'ok' : 'wrong');
      if (validate) setAttempt((a) => Math.min(5, a + 1));
    }, 600);
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Défis', to: '/defis' }, { label: challenge.subject }, { label: challenge.title }]} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{challenge.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded px-2 py-1 font-semibold text-white ${st.bar}`}>{challenge.subject}</span>
            <span className="rounded border border-slate-300 bg-white px-2 py-1">{challenge.difficulty}</span>
            <span className="rounded border border-brand bg-brand-light px-2 py-1 font-semibold text-brand">
              +{challenge.points} pts
            </span>
            <span className="italic text-muted">Compétence BUT : {subjectCompetence[challenge.subject]}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Meter label="Temps" value="12:34" />
          <Meter label="Tentative" value={`${attempt} / 5`} />
          <button onClick={() => setFav((f) => !f)} aria-pressed={fav} aria-label="Favori">
            <Star className={`h-6 w-6 ${fav ? 'fill-navy text-navy' : 'text-muted'}`} />
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-lg border border-sky-600 bg-white">
            <h2 className="bg-sky-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">Énoncé</h2>
            <div className="space-y-3 p-4 text-sm">
              <p>{sql.statement}</p>
              <p>{sql.order}</p>
              <p className="rounded bg-panel p-2 text-xs italic text-muted">{sql.note}</p>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-navy bg-white">
            <h2 className="bg-navy px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">Tables disponibles</h2>
            <div className="space-y-4 p-4">
              {sql.tables.map((t) => (
                <div key={t.name}>
                  <p className="mb-1 text-xs font-semibold">{t.name}</p>
                  <DataTable columns={t.columns} rows={t.rows} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-lg border border-navy bg-white">
            <h2 className="bg-navy px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">Votre requête SQL</h2>
            <div className="p-4">
              <label className="sr-only" htmlFor="sql-editor">Éditeur de requête SQL</label>
              <textarea
                id="sql-editor"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                spellCheck={false}
                rows={8}
                className="w-full resize-y rounded-md bg-[#1b2238] p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button onClick={() => run(false)} disabled={result === 'running'} className={buttonOutline}>
                  Exécuter
                </button>
                <button onClick={() => run(true)} disabled={result === 'running'} className={buttonBrand}>
                  Valider ma réponse
                </button>
                <span className="ml-auto text-[11px] italic text-muted">Environnement isolé · limite 5 s</span>
              </div>
            </div>
          </section>

          <section className={`overflow-hidden rounded-lg border bg-white ${result === 'ok' ? 'border-green-600' : 'border-red-600'}`}>
            <h2 className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white ${result === 'ok' ? 'bg-green-600' : 'bg-red-600'}`}>
              Résultat de l’exécution
            </h2>
            <div className="space-y-4 p-4" aria-live="polite">
              {result === 'running' && <p className="text-sm text-muted">Exécution en cours…</p>}
              {result === 'ok' && (
                <p className="flex items-center gap-2 rounded-md bg-green-100 px-3 py-2 text-sm text-green-800">
                  <CheckCircle2 className="h-4 w-4" /> Bravo ! Résultat identique. +{challenge.points} pts
                </p>
              )}
              {(result === 'wrong' || result === 'idle') && (
                <>
                  <p className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                    <XCircle className="h-4 w-4 shrink-0" />
                    Résultat différent : il manque 1 ligne ({sql.obtained.rows.length} obtenues, {sql.expected.rows.length} attendues).
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-green-700">RÉSULTAT ATTENDU · {sql.expected.rows.length} lignes</p>
                      <DataTable columns={sql.expected.columns} rows={sql.expected.rows} tone="bg-green-50" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-red-700">VOTRE RÉSULTAT · {sql.obtained.rows.length} lignes</p>
                      <DataTable columns={sql.obtained.columns} rows={sql.obtained.rows} tone="bg-red-50" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-navy bg-white">
        <h2 className="bg-navy px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
          Indices IA · sans donner la réponse
        </h2>
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            {sql.hints.map((h, i) => {
              const open = i < unlocked;
              return (
                <div
                  key={h.title}
                  className={`rounded-md border p-3 text-xs ${open ? 'border-brand bg-brand-light' : 'border-slate-200 bg-panel text-muted'}`}
                >
                  <p className="mb-1 flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5">
                      {!open && <Lock className="h-3 w-3" />}
                      {h.title}{!open && ' · verrouillé'}
                    </span>
                    <span className={open ? 'text-[10px] font-bold text-brand' : ''}>
                      {h.cost === 0 ? 'GRATUIT' : `-${h.cost} pts`}
                    </span>
                  </p>
                  <p>{open ? h.text : 'Débloque cet indice pour le lire.'}</p>
                </div>
              );
            })}
          </div>
          {unlocked < sql.hints.length && (
            <button onClick={() => setUnlocked((u) => u + 1)} className={`${buttonOutline} mt-3`}>
              Débloquer l’indice {unlocked + 1}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function DataTable({ columns, rows, tone = 'bg-white' }: { columns: string[]; rows: string[][]; tone?: string }) {
  return (
    <div className={`overflow-x-auto rounded border border-slate-200 ${tone}`}>
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-100">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-1.5 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-200">
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-1.5">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
