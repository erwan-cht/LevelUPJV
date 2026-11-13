import { useState } from 'react';
import { ChevronDown, LogOut, Menu, User, X } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import Logo from './layout/Logo';
import { formatNumber } from './ui';

export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
}

export const studentNav: NavItem[] = [
  { label: 'Tableau de bord', to: '/', end: true },
  { label: 'Défis', to: '/defis' },
  { label: 'Classement', to: '/classement' },
  { label: 'Duels', to: '/duels' },
  { label: 'Mon profil', to: '/profil' },
];

interface HeaderProps {
  links: NavItem[];
  /** Points affichés (étudiant) ou nom de l'utilisateur (enseignant). */
  chip: string;
  badge?: string;
  home?: string;
  profilePath?: string;
}

export default function Header({ links, chip, badge, home = '/', profilePath }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const out = () => {
    logout();
    navigate('/connexion');
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Logo to={home} badge={badge} />

        <nav className="mx-auto hidden h-full md:flex" aria-label="Navigation principale">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex items-center border-b-2 px-4 text-sm transition-colors ${
                  isActive ? 'border-brand font-medium' : 'border-transparent hover:text-brand'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative ml-auto flex items-center gap-3 md:ml-0">
          <span className="rounded-full bg-brand-light px-3 py-1 text-sm font-semibold">{chip}</span>
          <button
            className="flex items-center gap-1"
            aria-label="Menu du compte"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-white">
              <User className="h-5 w-5" />
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {menu && (
            <div className="absolute right-0 top-11 w-48 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
              {profilePath && (
                <Link to={profilePath} onClick={() => setMenu(false)} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                  <User className="h-4 w-4" /> Mon profil
                </Link>
              )}
              <button onClick={out} className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-slate-50">
                <LogOut className="h-4 w-4" /> Déconnexion
              </button>
            </div>
          )}
          <button className="md:hidden" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 md:hidden" aria-label="Navigation mobile">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm ${isActive ? 'bg-brand-light font-medium' : ''}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}

export { formatNumber };
