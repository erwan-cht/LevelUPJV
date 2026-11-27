import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bot, ChevronDown, Code2, Network, LogOut, Menu, Radio, Settings, Swords, User, X, Zap, type LucideIcon } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import SoundToggle from '../fx/SoundToggle';
import Logo from './layout/Logo';
import { formatNumber } from './ui';

export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
  /** Pour une entrée de sous-menu : icône et courte description. */
  icon?: LucideIcon;
  hint?: string;
  /** Entrée qui ouvre un sous-menu au lieu d'une page. */
  children?: NavItem[];
}

export const studentNav: NavItem[] = [
  { label: 'Accueil', to: '/', end: true },
  {
    label: 'Apprendre',
    to: '/defis',
    children: [
      { label: 'Défis', to: '/defis', icon: Code2, hint: 'Entraîne-toi sur les exercices' },
      { label: 'Compétences', to: '/competences', icon: Network, hint: 'Ton arbre de compétences' },
      { label: 'Assistant', to: '/assistant', icon: Bot, hint: 'Pose tes questions sur le cours' },
      { label: 'Quiz', to: '/quiz', icon: Zap, hint: 'Révise avec des questions rapides' },
    ],
  },
  { label: 'Classement', to: '/classement' },
  {
    label: 'Compétition',
    to: '/duels',
    children: [
      { label: 'Duels', to: '/duels', icon: Swords, hint: 'Affronte un camarade' },
      { label: 'Arène', to: '/arene', icon: Radio, hint: 'Rejoins une séance en direct' },
    ],
  },
  { label: 'Examen', to: '/examen' },
  // « Mon profil » est dans le menu de l'avatar, à droite.
];

const isUnder = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

/** Entrée de la barre qui ouvre un petit menu (Compétition, Apprendre). */
function NavGroup({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const active = item.children!.some((c) => isUnder(pathname, c.to));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative flex h-full">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 whitespace-nowrap border-b-2 px-4 text-sm transition-colors ${
          active ? 'border-brand font-medium' : 'border-transparent hover:text-brand'
        }`}
      >
        {item.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-slate-200 bg-white p-1 shadow-lg" role="menu">
          {item.children!.map((c) => {
            const Icon = c.icon;
            return (
              <NavLink
                key={c.to}
                to={c.to}
                role="menuitem"
                className={({ isActive }) => `flex items-start gap-3 rounded px-3 py-2 hover:bg-slate-50 ${isActive ? 'bg-brand-light' : ''}`}
              >
                {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
                <span>
                  <span className="block text-sm font-medium">{c.label}</span>
                  {c.hint && <span className="block text-xs text-muted">{c.hint}</span>}
                </span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface HeaderProps {
  links: NavItem[];
  /** Points affichés (étudiant) ou nom de l'utilisateur (enseignant). */
  chip: ReactNode;
  badge?: string;
  home?: string;
  profilePath?: string;
  /** Page des paramètres du compte (photo, mot de passe…). */
  settingsPath?: string;
  /** Photo de profil ; sans photo, une icône est affichée. */
  avatarUrl?: string | null;
  /** Élément affiché avant le compteur (par exemple la cloche de notifications). */
  extra?: React.ReactNode;
}

export default function Header({ links, chip, badge, home = '/', profilePath, settingsPath, avatarUrl, extra }: HeaderProps) {
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
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Logo to={home} badge={badge} />

        <nav className="mx-auto hidden h-full lg:flex" aria-label="Navigation principale">
          {links.map((l) => l.children ? (
            <NavGroup key={l.label} item={l} />
          ) : (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex items-center whitespace-nowrap border-b-2 px-4 text-sm transition-colors ${
                  isActive ? 'border-brand font-medium' : 'border-transparent hover:text-brand'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative ml-auto flex items-center gap-2 sm:gap-3 lg:ml-0">
          {extra}
          <span className="hidden sm:block">
            <SoundToggle />
          </span>
          <span className="max-w-[6.5rem] truncate whitespace-nowrap rounded-full bg-brand-light px-2.5 py-1 text-sm font-semibold sm:max-w-none sm:px-3">{chip}</span>
          <button
            className="flex items-center gap-1"
            aria-label="Menu du compte"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-navy text-white">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <User className="h-5 w-5" />}
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
              {settingsPath && (
                <Link to={settingsPath} onClick={() => setMenu(false)} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                  <Settings className="h-4 w-4" /> Paramètres
                </Link>
              )}
              <button onClick={out} className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-slate-50">
                <LogOut className="h-4 w-4" /> Déconnexion
              </button>
            </div>
          )}
          <button className="lg:hidden" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden" aria-label="Navigation mobile">
          {links.flatMap((l) => l.children ? [{ ...l, heading: true }, ...l.children] : [l]).map((l) => 'heading' in l ? (
            <p key={`titre-${l.label}`} className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{l.label}</p>
          ) : (
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
          {/* Sur téléphone, le bouton des sons est ici : il ne tient plus dans l'en-tête */}
          <div className="mt-1 border-t border-slate-100 pt-1 sm:hidden">
            <SoundToggle withLabel />
          </div>
        </nav>
      )}
    </header>
  );
}

export { formatNumber };
