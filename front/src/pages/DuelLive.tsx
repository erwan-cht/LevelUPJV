import { useEffect, useState } from 'react';
import { Check, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { duelCode, duelFeed, duelTests } from '../data/community';
import { Avatar, Breadcrumb, Card, CardTitle, ProgressBar, buttonOutline, buttonPrimary } from '../components/ui';

const pad = (n: number) => String(n).padStart(2, '0');

export default function DuelLive() {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(272); // 04:32
  const [code, setCode] = useState(duelCode);
  const [passed, setPassed] = useState(duelTests.map((t) => t.passed));
  const [opponentPassed, setOpponentPassed] = useState(2);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted) return;
    const id = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [submitted]);

  const myScore = passed.filter(Boolean).length;
  const allPassed = myScore === duelTests.length;

  const runTests = () => {
    // Simulation : chaque lancement valide le test suivant, l'adversaire progresse parfois.
    setPassed((prev) => {
      const next = [...prev];
      const i = next.indexOf(false);
      if (i !== -1) next[i] = true;
      return next;
    });
    setOpponentPassed((n) => Math.min(duelTests.length - 1, n + (myScore % 2)));
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Duels', to: '/duels' }, { label: 'Duel en direct' }]} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Duel en direct</h1>
          <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {submitted ? 'Terminé' : 'En cours'}
          </span>
        </div>
        <p className="text-xs italic text-muted">Algorithmique · Facile · Tri d’un tableau</p>
      </div>

      {/* Bandeau des joueurs */}
      <section className="grid items-center gap-4 rounded-lg bg-navy p-5 text-white md:grid-cols-[1fr_auto_1fr]">
        <Player initials="OL" name="Oscar Lescot" sub="BUT 2 · Groupe 2 · Ligue Argent" score={myScore} total={duelTests.length} color="bg-brand" />
        <div className="text-center">
          <p className="text-xs font-bold text-brand">VS</p>
          <p className="font-mono text-4xl font-bold tabular-nums" aria-live="off">
            {pad(Math.floor(seconds / 60))}:{pad(seconds % 60)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-slate-300">Temps restant</p>
          <p className="mt-2 inline-block rounded bg-brand px-3 py-1 text-[11px] font-bold text-navy">+60 pts pour le vainqueur</p>
        </div>
        <Player initials="LM" name="Léa Marchand" sub="BUT 2 · Groupe 2 · Ligue Or" score={opponentPassed} total={duelTests.length} color="bg-slate-500" right />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Énoncé</CardTitle>
              <span className="text-[11px] text-muted">Algorithmique · Facile</span>
            </div>
            <p className="mt-2 text-sm">
              Écrivez une fonction <code className="rounded bg-white px-1 font-mono text-xs">tri_croissant(liste)</code> qui
              renvoie une <strong>nouvelle</strong> liste contenant les mêmes éléments, triés par ordre croissant.
            </p>
            <p className="mt-3 rounded bg-white p-2 text-xs italic text-muted">
              Interdit : <code className="font-mono">sorted()</code> et <code className="font-mono">list.sort()</code>. La liste d’origine ne doit pas être modifiée.
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Votre code Python</CardTitle>
              <span className="text-[11px] text-muted">Environnement isolé · limite 2 s par test</span>
            </div>
            <label className="sr-only" htmlFor="duel-editor">Éditeur de code Python</label>
            <textarea
              id="duel-editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              rows={9}
              disabled={submitted}
              className="mt-3 w-full resize-y rounded-md bg-[#1b2238] p-4 font-mono text-xs leading-6 text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <button onClick={runTests} disabled={submitted || allPassed} className={buttonOutline}>Lancer les tests</button>
              <button onClick={() => setSubmitted(true)} disabled={!allPassed || submitted} className={buttonPrimary}>
                Soumettre ma solution
              </button>
              <button
                onClick={() => navigate('/duels')}
                className="ml-auto rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Abandonner
              </button>
            </div>
            <p className="mt-2 text-xs italic text-muted">
              {submitted
                ? 'Solution envoyée : en attente du résultat de Léa. Victoire +60 pts !'
                : 'Soumettez quand tous les tests sont verts : le premier à réussir remporte le duel.'}
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Tests</CardTitle>
              <span className="text-xs text-muted">{myScore} / {duelTests.length} réussis</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {duelTests.map((t, i) => (
                <li key={t.label} className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-sm">
                  {passed[i] ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white"><Check className="h-3 w-3" /></span>
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300" />
                  )}
                  <span className="flex-1">{t.label}</span>
                  <code className="font-mono text-[11px] text-muted">{t.expected}</code>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Fil du duel</CardTitle>
              <span className="text-[11px] text-muted">en direct</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
              {duelFeed.map((e, i) => (
                <li key={i} className="flex gap-3 rounded bg-white px-3 py-2">
                  <span className="font-mono text-muted">{e.time}</span>
                  <span>{e.who && <strong className={e.who === 'Vous' ? '' : 'text-brand'}>{e.who} </strong>}{e.text}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle>Règles du duel</CardTitle>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-xs text-muted marker:text-sky-600">
              <li>Le premier qui réussit les 5 tests gagne les points. En cas d’égalité, le plus rapide l’emporte.</li>
              <li>Le code de ton adversaire reste masqué : tu ne vois que sa progression.</li>
              <li>Chaque duel utilise une variante de l’exercice, tirée au hasard pour les deux joueurs.</li>
              <li>Pas d’indices IA pendant un duel.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Player({ initials, name, sub, score, total, color, right }: { initials: string; name: string; sub: string; score: number; total: number; color: string; right?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${right ? 'md:flex-row-reverse md:text-right' : ''}`}>
      <Avatar initials={initials} color={color} size="h-14 w-14 text-lg" />
      <div className="flex-1">
        <p className="font-semibold">{name}</p>
        <p className="text-[11px] text-slate-300">{sub}</p>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="whitespace-nowrap">Tests réussis</span>
          <ProgressBar value={score} max={total} color={right ? 'bg-brand' : 'bg-white'} track="bg-white/20" height="h-2" />
          <strong className="whitespace-nowrap">{score} / {total}</strong>
        </div>
      </div>
    </div>
  );
}
