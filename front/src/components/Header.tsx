import { ChevronDown, GraduationCap, User } from 'lucide-react';
import { formatNumber } from './ui';

const links = ['Tableau de bord', 'Défis', 'Classement', 'Duels', 'Mon profil'];

export default function Header({ points }: { points: number }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <a href="#" className="flex items-center gap-2 text-xl font-bold">
          <GraduationCap className="h-6 w-6" />
          <span>
            Level<span className="text-brand">UP</span>JV
          </span>
        </a>

        <nav className="mx-auto hidden h-full md:flex">
          {links.map((label, i) => (
            <a
              key={label}
              href="#"
              aria-current={i === 0 ? 'page' : undefined}
              className={`flex items-center border-b-2 px-4 text-sm transition-colors ${
                i === 0 ? 'border-brand font-medium' : 'border-transparent hover:text-brand'
              }`}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4 md:ml-0">
          <span className="rounded-full bg-brand-light px-3 py-1 text-sm font-semibold">
            {formatNumber(points)} pts
          </span>
          <button className="flex items-center gap-1" aria-label="Menu du compte">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-white">
              <User className="h-5 w-5" />
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
