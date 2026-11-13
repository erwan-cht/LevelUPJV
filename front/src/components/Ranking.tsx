import { Fragment, useState } from 'react';
import { Star } from 'lucide-react';
import type { RankingEntry } from '../types';
import { Avatar, Card, CardTitle, Delta, Tabs, formatNumber } from './ui';

type Scope = 'promo' | 'groupe';

export default function Ranking({ promo, groupe }: { promo: RankingEntry[]; groupe: RankingEntry[] }) {
  const [scope, setScope] = useState<Scope>('promo');
  const entries = scope === 'promo' ? promo : groupe;

  const meIndex = entries.findIndex((e) => e.isMe);
  const me = entries[meIndex];
  const ahead = meIndex > 0 ? entries[meIndex - 1] : undefined;
  const gap = me && ahead && ahead.rank === me.rank - 1 ? ahead.points - me.points : undefined;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>Classement</CardTitle>
        <Tabs
          tabs={[
            { id: 'promo', label: 'Promo' },
            { id: 'groupe', label: 'Groupe' },
          ]}
          value={scope}
          onChange={setScope}
        />
      </div>

      <ol className="space-y-2">
        {entries.map((e, i) => {
          const skipped = i > 0 && e.rank - entries[i - 1].rank > 1;
          return (
            <Fragment key={e.rank}>
              {skipped && (
                <li aria-hidden className="text-center text-xs leading-none text-muted">
                  · · ·
                </li>
              )}
              <li
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                  e.isMe ? 'border border-brand bg-brand-light' : 'bg-white'
                }`}
              >
                <span className="w-5 text-xs font-semibold">{e.rank}</span>
                <Avatar initials={e.initials} color={e.isMe ? 'bg-brand' : 'bg-navy'} />
                <span className={`flex-1 truncate text-xs ${e.isMe ? 'font-bold' : ''}`}>{e.name}</span>
                <span className="text-xs font-semibold">{formatNumber(e.points)} pts</span>
                <span className="w-8 text-right">
                  <Delta value={e.delta} />
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>

      {gap !== undefined && ahead && (
        <p className="mt-3 flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs">
          <Star className="h-3.5 w-3.5 shrink-0 fill-brand text-brand" />
          <span>
            À <strong>{gap} pts</strong> de {ahead.name.split(' ')[0]} (#{ahead.rank}) : un défi facile suffit.
          </span>
        </p>
      )}

      <a href="#" className="mt-4 inline-block text-xs font-semibold text-brand hover:underline">
        Voir le classement complet →
      </a>
    </Card>
  );
}
