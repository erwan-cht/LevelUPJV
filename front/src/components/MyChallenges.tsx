import { useState } from 'react';
import { subjects } from '../subjects';
import SubjectLogo from './SubjectLogo';
import { Link } from 'react-router-dom';
import type { Challenge, ChallengeStatus, Subject } from '../types';
import { Card, CardTitle, ProgressBar, Tabs } from './ui';

const tabs: { id: ChallengeStatus; label: string }[] = [
  { id: 'recommande', label: 'Recommandés' },
  { id: 'en-cours', label: 'En cours' },
  { id: 'termine', label: 'Terminés' },
];

const LIMIT = 4;
const difficultyRank: Record<string, number> = { Facile: 0, Moyen: 1, Difficile: 2 };

/**
 * Un défi conseillé par matière (4 au plus) : d'abord ceux donnés par un enseignant,
 * puis le plus facile, puis le plus ancien.
 */
function recommendations(challenges: Challenge[]): Challenge[] {
  return subjects.flatMap((s) => {
    const pick = challenges
      .filter((c) => c.status === 'recommande' && c.category === s)
      .sort(
        (a, b) =>
          Number(Boolean(b.assigned)) - Number(Boolean(a.assigned)) ||
          (difficultyRank[a.difficulty] ?? 9) - (difficultyRank[b.difficulty] ?? 9) ||
          a.id - b.id,
      )[0];
    return pick ? [pick] : [];
  });
}

export default function MyChallenges({ challenges }: { challenges: Challenge[] }) {
  const hasInProgress = challenges.some((c) => c.status === 'en-cours');
  // « En cours » par défaut seulement s'il y a un défi commencé ; sinon les recommandations.
  const [tab, setTab] = useState<ChallengeStatus>(hasInProgress ? 'en-cours' : 'recommande');
  const [expanded, setExpanded] = useState(false);

  const list = tab === 'recommande' ? recommendations(challenges) : challenges.filter((c) => c.status === tab);
  const visible = expanded ? list : list.slice(0, LIMIT);
  const hidden = list.length - LIMIT;
  const empty = { 'en-cours': 'Aucun défi en cours : commence un défi recommandé !', recommande: 'Tu as fait le tour des défis disponibles, bravo !', termine: 'Aucun défi terminé pour le moment.' }[tab];

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Mes défis</CardTitle>
        <Tabs
          tabs={tabs}
          value={tab}
          onChange={(t) => {
            setTab(t);
            setExpanded(false);
          }}
        />
      </div>

      <ul className="space-y-3">
        {visible.map((c) => (
          <ChallengeRow key={c.id} challenge={c} />
        ))}
        {visible.length === 0 && <li className="text-sm text-muted">{empty}</li>}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 w-full rounded-md border border-slate-300 bg-white py-2 text-xs font-semibold text-navy hover:bg-slate-50"
        >
          {expanded ? 'Voir moins' : `Voir plus (${hidden})`}
        </button>
      )}

      <Link to="/defis" className="mt-4 inline-block text-xs font-semibold text-brand hover:underline">
        Voir tous les défis →
      </Link>
    </Card>
  );
}

function ChallengeRow({ challenge: c }: { challenge: Challenge }) {
  const pct = Math.round((c.testsPassed / c.testsTotal) * 100);
  const notStarted = c.testsPassed === 0;
  const done = c.status === 'termine';
  const action = done ? 'Revoir' : notStarted ? 'Commencer' : 'Reprendre';

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md bg-white p-3 sm:flex-nowrap">
      <SubjectLogo subject={c.category as Subject} />

      {/* Sur mobile, le titre prend toute la ligne ; progression et bouton passent dessous */}
      <div className="min-w-0 flex-1 basis-[calc(100%-3.25rem)] sm:basis-auto">
        <p className="truncate text-sm font-semibold">{c.title}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <span className={`h-2 w-2 rounded-full ${c.categoryColor}`} />
          {c.category} · <span className="font-semibold text-navy">{c.difficulty}</span>
        </p>
      </div>

      <div className="flex-1 sm:w-28 sm:flex-none">
        <div className="mb-1 flex justify-between text-[10px] text-muted">
          <span>{notStarted ? 'Nouveau' : `${c.testsPassed}/${c.testsTotal} tests`}</span>
          <span>{pct}%</span>
        </div>
        <ProgressBar value={c.testsPassed} max={c.testsTotal} color={done ? 'bg-green-600' : 'bg-navy'} />
      </div>

      <span className="w-16 shrink-0 text-right text-sm font-bold text-brand">+{c.points} pts</span>

      <Link
        to={`/defis/${c.id}`}
        className="w-24 shrink-0 rounded bg-navy py-2 text-center text-xs font-semibold text-white transition hover:bg-navy-light"
      >
        {action}
      </Link>
    </li>
  );
}
