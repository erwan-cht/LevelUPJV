import { Link } from 'react-router-dom';
import BadgeIcon from './BadgeIcon';
import type { Badge } from '../types';
import { Card, CardTitle, ProgressBar } from './ui';

const variantClass: Record<Badge['variant'], string> = {
  navy: 'bg-navy',
  orange: 'bg-brand',
  locked: 'bg-slate-300',
};

export default function Badges({
  badges,
  next,
}: {
  badges: Badge[];
  next: { name: string; progress: number; total: number; unit: string } | null;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>Badges</CardTitle>
        <Link to="/succes" className="text-xs font-semibold text-brand hover:underline">
          Tous les badges
        </Link>
      </div>

      <ul className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        {badges.map((b) => (
          <li key={b.name} className="flex flex-col items-center gap-2 text-center">
            <BadgeIcon slug={b.slug} locked={b.variant === 'locked'} color={variantClass[b.variant]} />
            <span className={`text-xs ${b.variant === 'locked' ? 'text-muted' : 'font-medium'}`}>{b.name}</span>
          </li>
        ))}
      </ul>

      {next && (
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-white px-3 py-2 text-xs sm:flex-nowrap">
        <span className="shrink-0 font-semibold">Prochain badge</span>
        <ProgressBar value={next.progress} max={next.total} color="bg-brand" />
        <span className="shrink-0 text-muted">
          {next.name} · {next.progress} / {next.total} {next.unit}
        </span>
      </div>
      )}
    </Card>
  );
}
