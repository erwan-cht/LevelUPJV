import { useState } from 'react';
import { Flag } from 'lucide-react';
import type { Challenge, ChallengeStatus } from '../types';
import { Card, CardTitle, ProgressBar, Tabs } from './ui';

const tabs: { id: ChallengeStatus; label: string }[] = [
  { id: 'en-cours', label: 'En cours' },
  { id: 'recommande', label: 'Recommandés' },
  { id: 'termine', label: 'Terminés' },
];

export default function MyChallenges({ challenges }: { challenges: Challenge[] }) {
  const [tab, setTab] = useState<ChallengeStatus>('en-cours');
  const visible = challenges.filter((c) => c.status === tab);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Mes défis</CardTitle>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>

      <ul className="space-y-3">
        {visible.map((c) => (
          <ChallengeRow key={c.id} challenge={c} />
        ))}
        {visible.length === 0 && <li className="text-sm text-muted">Aucun défi ici pour le moment.</li>}
      </ul>

      <a href="#" className="mt-4 inline-block text-xs font-semibold text-brand hover:underline">
        Voir tous les défis →
      </a>
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
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy text-white">
        <Flag className="h-4 w-4" />
      </span>

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

      <button className="w-24 shrink-0 rounded bg-navy py-2 text-xs font-semibold text-white transition hover:bg-navy-light">
        {action}
      </button>
    </li>
  );
}
