import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useApi } from '../api';
import PageState from '../components/PageState';
import { leagues } from '../data/community';
import { useMe } from '../me';
import type { Student } from '../types';
import { Avatar, Breadcrumb, Card, CardTitle, Delta, PageTitle, ProgressBar, Tabs, formatNumber } from '../components/ui';

type Scope = 'promo' | 'groupe';

interface RankingData {
  entries: Student[];
  weekly: { label: string; points: number }[];
}

export default function Classement() {
  const [scope, setScope] = useState<Scope>('promo');
  const { data, loading, error, reload } = useApi<RankingData>(`/ranking?scope=${scope}`);

  return (
    <PageState loading={loading && !data} error={error} onRetry={reload}>
      {data && <ClassementContent students={data.entries} weeklyPoints={data.weekly} scope={scope} setScope={setScope} />}
    </PageState>
  );
}

function ClassementContent({
  students,
  weeklyPoints,
  scope,
  setScope,
}: {
  students: Student[];
  weeklyPoints: { label: string; points: number }[];
  scope: Scope;
  setScope: (s: Scope) => void;
}) {
  const { me } = useMe();
  const points = me?.points ?? 0;
  const [query, setQuery] = useState('');
  const [promotion, setPromotion] = useState('BUT 2 Informatique');
  const [saison, setSaison] = useState('Saison 2025-2026');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? students.filter((s) => s.name.toLowerCase().includes(q)) : students;
  }, [students, query]);

  const podium = students.slice(0, 3);
  const order = [podium[1], podium[0], podium[2]];
  const maxWeek = Math.max(1, ...weeklyPoints.map((w) => w.points));
  const nextLeague = leagues[2];
  const ordinals = ['1er', '2e', '3e'];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Classement' }]} />
      <PageTitle title="Classement" subtitle={`${saison} · mis à jour il y a 4 minutes`}>
        <label className="relative">
          <span className="sr-only">Rechercher un étudiant</span>
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un étudiant"
            className="w-60 rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>
      </PageTitle>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <Tabs tabs={[{ id: 'promo', label: 'Ma promo' }, { id: 'groupe', label: 'Mon groupe' }]} value={scope} onChange={setScope} />
        <Select label="Promotion" value={promotion} onChange={setPromotion} options={['BUT 1 Informatique', 'BUT 2 Informatique', 'BUT 3 Informatique']} />
        <Select label="Saison" value={saison} onChange={setSaison} options={['Saison 2025-2026', 'Saison 2024-2025']} />
      </div>

      {/* Podium */}
      <div className="grid grid-cols-3 items-end gap-3">
        {order.map((s, idx) => {
          const place = podium.indexOf(s);
          const height = place === 0 ? 'pt-8' : 'pt-4';
          return (
            <div key={s.initials} className={`rounded-lg bg-navy px-3 pb-4 text-center text-white ${height}`}>
              <p className={`text-sm font-bold ${place === 0 ? 'text-brand' : 'text-slate-300'}`}>{ordinals[place]}</p>
              <Avatar initials={s.initials} color={place === 0 ? 'bg-brand' : 'bg-white/20'} size="mx-auto mt-2 h-12 w-12 text-sm" />
              <p className="mt-2 text-sm font-semibold">{s.name}</p>
              <p className="text-[11px] text-slate-300">{s.group}</p>
              <p className="mt-2 text-xl font-bold">{formatNumber(s.points)} <span className="text-xs font-normal">pts</span></p>
              <p className="text-[11px] text-slate-300">Niveau {s.level}</p>
              <span className="sr-only">Position {idx + 1} du podium</span>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Rang</th>
                <th className="px-2 py-3 font-medium">Étudiant</th>
                <th className="px-2 py-3 font-medium">Groupe</th>
                <th className="px-2 py-3 font-medium">Niveau</th>
                <th className="px-2 py-3 font-medium">Défis</th>
                <th className="px-2 py-3 text-right font-medium">Points</th>
                <th className="px-4 py-3 text-right font-medium">Évol.</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr
                  key={s.initials}
                  className={`border-t border-slate-200 ${s.isMe ? 'bg-brand-light font-semibold' : 'bg-white/60'}`}
                  aria-current={s.isMe ? 'true' : undefined}
                >
                  <td className="px-4 py-2.5">{s.rank}</td>
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar initials={s.initials} color={s.isMe ? 'bg-brand' : 'bg-navy'} />
                      {s.name}{s.isMe && ' (toi)'}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-xs text-muted">{s.group}</td>
                  <td className="px-2 py-2.5">{s.level}</td>
                  <td className="px-2 py-2.5">{s.challenges}</td>
                  <td className="px-2 py-2.5 text-right font-semibold">{formatNumber(s.points)}</td>
                  <td className="px-4 py-2.5 text-right"><Delta value={s.delta} /></td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted">Aucun étudiant trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <aside className="space-y-5">
          <Card>
            <CardTitle>Ma ligue · Argent</CardTitle>
            <ul className="mt-3 space-y-1.5 text-xs">
              {leagues.map((l) => (
                <li key={l.name} className={`flex items-center justify-between rounded px-2 py-1.5 ${l.name === 'Argent' ? 'bg-white font-semibold ring-1 ring-brand' : ''}`}>
                  <span className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${l.color}`} /> {l.name}
                  </span>
                  <span className="text-muted">{formatNumber(l.min)}+ pts</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-semibold">Vers la ligue {nextLeague.name}</p>
            <ProgressBar value={points} max={nextLeague.min} color="bg-brand" track="bg-white" height="h-2" />
            <p className="mt-1 text-[11px] text-muted">
              {formatNumber(points)} / {formatNumber(nextLeague.min)} · Encore {nextLeague.min - points} pts pour monter en ligue {nextLeague.name}.
            </p>
          </Card>

          <Card>
            <CardTitle>Points par semaine</CardTitle>
            <p className="text-xs text-muted">6 dernières semaines</p>
            <div className="mt-4 flex h-32 items-end gap-3" role="img" aria-label="Histogramme des points par semaine">
              {weeklyPoints.map((w, i) => (
                <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-muted">{w.points}</span>
                  <div
                    className={`w-full rounded-t ${i === weeklyPoints.length - 1 ? 'bg-brand' : 'bg-navy'}`}
                    style={{ height: `${(w.points / maxWeek) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted">{w.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">{weeklyPoints[weeklyPoints.length - 1]?.points ?? 0} pts gagnés cette semaine.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs focus:border-brand focus:outline-none"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
