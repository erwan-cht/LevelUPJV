import type { ActivityDay } from '../types';
import { Card, CardTitle } from './ui';

const CHART_HEIGHT = 110; // px pour la barre la plus haute

export default function Activity({ days }: { days: ActivityDay[] }) {
  const max = Math.max(...days.map((d) => d.points), 1);
  const total = days.reduce((sum, d) => sum + d.points, 0);
  const best = days.reduce((a, b) => (b.points > a.points ? b : a));
  const bestLabel = best.isToday ? "aujourd'hui" : best.label.toLowerCase();

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>Mon activité</CardTitle>
        <span className="text-xs text-muted">7 derniers jours</span>
      </div>

      <div className="flex items-end justify-around gap-2 border-b border-slate-300 px-2 pb-2">
        {days.map((d, i) => (
          <div key={i} className="flex w-10 min-w-0 flex-col items-center">
            <span className="mb-1 text-[10px] font-semibold">{d.points}</span>
            <div
              className={`w-full rounded-t-sm ${d.isToday ? 'bg-brand' : 'bg-navy'}`}
              style={{ height: Math.max(2, (d.points / max) * CHART_HEIGHT) }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-around gap-2 px-2 pt-1">
        {days.map((d, i) => (
          <span key={i} className={`w-10 text-center text-[10px] ${d.isToday ? 'font-bold' : 'text-muted'}`}>
            {d.label}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-2 rounded-md bg-white px-3 py-2 text-xs">
        <span>
          <strong>{total} pts</strong> gagnés cette semaine
        </span>
        <span className="text-muted italic">Ton meilleur jour : {bestLabel}</span>
      </div>
    </Card>
  );
}
