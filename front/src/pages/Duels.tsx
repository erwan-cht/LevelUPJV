import { useState } from 'react';
import { Code2, Database, Globe, Network, Swords } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { opponents, pendingInvites, recentDuels } from '../data/community';
import { catalog, subjects } from '../data/catalog';
import type { Difficulty, Subject } from '../types';
import { Avatar, Breadcrumb, Card, CardTitle, Segmented, buttonBrand, buttonOutline } from '../components/ui';

const icons: Record<Subject, typeof Database> = {
  'Bases de données': Database,
  Algorithmique: Code2,
  'Développement web': Globe,
  'Réseaux & systèmes': Network,
};

const iconColor: Record<Subject, string> = {
  'Bases de données': 'bg-sky-600',
  Algorithmique: 'bg-brand',
  'Développement web': 'bg-navy',
  'Réseaux & systèmes': 'bg-red-600',
};

type Level = Difficulty | 'Au hasard';
type Kind = 'classe' | 'amical';

export default function Duels() {
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject>('Algorithmique');
  const [level, setLevel] = useState<Level>('Moyen');
  const [kind, setKind] = useState<Kind>('classe');
  const [searching, setSearching] = useState(false);
  const [invites, setInvites] = useState(pendingInvites);

  const start = () => {
    setSearching(true);
    window.setTimeout(() => navigate('/duels/en-direct'), 1200);
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Duels' }]} />

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-navy p-6 text-white">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold">Affronte un camarade en direct</h1>
          <p className="mt-1 text-sm text-slate-300">
            Même exercice, même chrono : le premier à réussir tous les tests remporte les points. Choisis une matière,
            puis un adversaire.
          </p>
        </div>
        <div className="flex gap-3">
          {[['Victoires', '0'], ['Défaites', '1'], ['Duels joués', '1']].map(([label, value]) => (
            <div key={label} className="min-w-24 rounded-md bg-white/10 px-4 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-300">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardTitle>Paramètres du duel</CardTitle>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Matière</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {subjects.map((s) => {
                const Icon = icons[s];
                const selected = subject === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    aria-pressed={selected}
                    className={`rounded-lg border-2 bg-white p-3 text-left transition-colors ${selected ? 'border-brand' : 'border-transparent hover:border-slate-300'}`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-md text-white ${iconColor[s]}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="mt-2 text-sm font-semibold">{s}</p>
                    <p className="text-[11px] text-muted">{catalog.filter((c) => c.subject === s).length * 2 + 12} exercices</p>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted">Difficulté</p>
            <div className="mt-2">
              <Segmented<Level> options={['Facile', 'Moyen', 'Difficile', 'Au hasard']} value={level} onChange={setLevel} />
            </div>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted">Type de duel</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {([
                ['classe', 'Duel classé', '+60 pts au vainqueur, compte pour la ligue.'],
                ['amical', 'Duel amical', 'Pour s’entraîner : aucun point en jeu.'],
              ] as [Kind, string, string][]).map(([id, title, text]) => (
                <button
                  key={id}
                  onClick={() => setKind(id)}
                  aria-pressed={kind === id}
                  className={`rounded-lg border-2 bg-white p-3 text-left ${kind === id ? 'border-navy' : 'border-transparent hover:border-slate-300'}`}
                >
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted">{text}</p>
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button onClick={start} disabled={searching} className={buttonBrand}>
                <Swords className="h-4 w-4" />
                {searching ? 'Recherche d’un adversaire…' : 'Trouver un adversaire au hasard'}
              </button>
              <span className="text-xs italic text-muted">Ou défie directement un camarade dans la liste.</span>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Duels récents</CardTitle>
              <Link to="/profil" className="text-xs font-semibold text-brand hover:underline">Voir l’historique</Link>
            </div>
            <ul className="mt-3 space-y-2">
              {recentDuels.map((d, i) => (
                <li key={i} className="flex items-center gap-3 rounded-md bg-white px-3 py-2 text-sm">
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{d.result}</span>
                  <span className="flex-1">contre <strong>{d.opponent}</strong> · {d.subject}</span>
                  <span className="font-semibold">{d.points} pt</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs italic text-muted">
              Pas encore de victoire : le badge « Duelliste » se débloque dès ton premier duel gagné.
            </p>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Invitations reçues</CardTitle>
              <span className="text-xs text-muted">{invites.length}</span>
            </div>
            {invites.length === 0 && <p className="mt-3 text-sm text-muted">Aucune invitation pour le moment.</p>}
            {invites.map((inv) => (
              <div key={inv.name} className="mt-3 rounded-lg border border-brand bg-brand-light p-3">
                <div className="flex items-center gap-3 text-sm">
                  <Avatar initials={inv.initials} size="h-8 w-8 text-xs" />
                  <p><strong>{inv.name}</strong> te défie en <strong>{inv.subject}</strong> · {inv.difficulty}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => navigate('/duels/en-direct')} className={`${buttonBrand} px-3 py-1.5 text-xs`}>Accepter</button>
                  <button onClick={() => setInvites((l) => l.filter((x) => x.name !== inv.name))} className={`${buttonOutline} px-3 py-1.5 text-xs`}>Refuser</button>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle>Camarades en ligne</CardTitle>
              <span className="text-xs text-muted">{opponents.filter((o) => o.status === 'dispo').length} disponibles</span>
            </div>
            <ul className="mt-3 space-y-2">
              {opponents.map((o) => (
                <li key={o.name} className="flex items-center gap-3 rounded-md bg-white px-3 py-2">
                  <span className="relative">
                    <Avatar initials={o.initials} size="h-8 w-8 text-xs" />
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${o.status === 'dispo' ? 'bg-green-500' : 'bg-brand'}`} />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{o.name}</p>
                    <p className="text-[11px] text-muted">Niveau {o.level} · {o.league}</p>
                  </div>
                  {o.status === 'dispo' ? (
                    <button onClick={() => navigate('/duels/en-direct')} className={`${buttonOutline} px-3 py-1 text-xs`}>Défier</button>
                  ) : (
                    <span className="rounded bg-brand-light px-2 py-1 text-[11px] font-semibold text-brand">En duel</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
