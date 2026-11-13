import { Play, User as UserIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { User } from '../types';
import { ProgressBar, formatNumber } from './ui';

export default function HeroCard({ user, resumeTitle }: { user: User; resumeTitle: string }) {
  const xpLeft = user.xpNextLevel - user.xp;

  return (
    <section className="rounded-lg bg-navy p-6 text-white md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        {/* Avatar + niveau */}
        <div className="relative mx-auto shrink-0 md:mx-0">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-200">
            <UserIcon className="h-16 w-16 fill-navy text-navy" />
          </div>
          <span className="absolute right-0 bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-navy bg-brand text-xs font-bold">
            {user.level}
          </span>
        </div>

        {/* Infos et progression */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Salut {user.firstName} !</h1>
          <p className="text-xs text-slate-300">
            {user.formation} · {user.league}
          </p>

          <div className="mt-4 max-w-md">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold text-brand">Niveau {user.level}</span>
              <span className="text-xs text-slate-300">
                {formatNumber(user.xp)} / {formatNumber(user.xpNextLevel)} XP
              </span>
            </div>
            <ProgressBar value={user.xp} max={user.xpNextLevel} color="bg-brand" track="bg-navy-light" height="h-2" />
            <p className="mt-1 text-xs text-slate-300">
              Plus que <strong className="text-white">{xpLeft} XP</strong> avant le niveau {user.level + 1}, soit un
              défi moyen.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/defis/2" className="flex items-center gap-2 rounded bg-brand px-4 py-2 text-xs font-semibold transition hover:brightness-110">
              <Play className="h-3 w-3 fill-current" />
              Reprendre : {resumeTitle}
            </Link>
            <Link to="/defis" className="rounded border border-white px-4 py-2 text-xs font-semibold transition hover:bg-white hover:text-navy">
              Parcourir les défis
            </Link>
          </div>
        </div>

        {/* Statistiques */}
        <div className="flex gap-4 self-start md:self-auto">
          <Stat label="Points" value={formatNumber(user.points)} sub={`+${user.pointsToday} aujourd'hui`} />
          <Stat label="Rang promo" value={`#${user.promoRank}`} sub={`▲ ${user.rankDelta} places`} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-28 rounded-md bg-navy-light px-4 py-3">
      <p className="text-[10px] font-medium tracking-wide text-slate-300 uppercase">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] text-green-400">{sub}</p>
    </div>
  );
}
