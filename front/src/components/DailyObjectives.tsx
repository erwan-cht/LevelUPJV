import { Check } from 'lucide-react';
import type { DailyObjective, StreakDay } from '../types';
import { Card, CardTitle } from './ui';

export default function DailyObjectives({
  objectives,
  streak,
  streakDays,
}: {
  objectives: DailyObjective[];
  streak: StreakDay[];
  streakDays: number;
}) {
  const done = objectives.filter((o) => o.done).length;
  const todayValidated = streak.some((d) => d.state === 'today');

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>Objectifs du jour</CardTitle>
        <span className="text-xs font-semibold">
          {done} / {objectives.length}
        </span>
      </div>

      <ul className="space-y-2">
        {objectives.map((o) => (
          <li key={o.label} className="flex items-center gap-3 rounded-md bg-white px-3 py-2.5 text-xs">
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                o.done ? 'border-green-600 bg-green-600' : 'border-slate-300'
              }`}
              aria-label={o.done ? 'Terminé' : 'À faire'}
            >
              {o.done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
            </span>
            <span className={`flex-1 ${o.done ? 'text-muted line-through' : ''}`}>{o.label}</span>
            <span className="font-semibold text-brand">+{o.xp} XP</span>
          </li>
        ))}
      </ul>

      <ul className="mt-5 flex justify-between px-1">
        {streak.map((d, i) => (
          <li key={i} className="flex flex-col items-center gap-1">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                d.state === 'done'
                  ? 'border-brand bg-brand'
                  : d.state === 'today'
                    ? 'border-dashed border-navy bg-brand'
                    : 'border-slate-300 bg-white'
              }`}
            >
              {d.state !== 'todo' && <Check className="h-3 w-3 text-navy" strokeWidth={3} />}
            </span>
            <span className="text-[10px] text-muted">{d.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex justify-between text-[11px] text-muted italic">
        <span>Série en cours : {streakDays} jours</span>
        {todayValidated && <span>Aujourd'hui validé</span>}
      </div>
    </Card>
  );
}
