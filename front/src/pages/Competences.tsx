import { useEffect, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Lock, Sparkles, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../api';
import PageState from '../components/PageState';
import { Breadcrumb, PageTitle } from '../components/ui';

// ───────────── Types : reflet de back/src/skills.ts ─────────────

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type NodeStatus = 'done' | 'available' | 'locked';

interface Node {
  id: number;
  title: string;
  points: number;
  minutes: number;
  status: NodeStatus;
}

interface Branch {
  id: number;
  name: string;
  description: string;
  value: number;
  done: number;
  total: number;
  rank: { key: string; label: string };
  skills: { label: string; unlocked: boolean; at: number }[];
  tiers: { difficulty: Difficulty; unlocked: boolean; done: number; total: number; nodes: Node[] }[];
}

interface Tree {
  branches: Branch[];
  next: { id: number; title: string; competence: string; difficulty: Difficulty } | null;
  totals: { done: number; total: number; mastery: number };
}

const COLORS = ['#0094CC', '#E98C08', '#198754', '#8B5CF6', '#CC3340', '#14B8A6'];
const TIER_LABEL: Record<Difficulty, string> = { EASY: 'Facile', MEDIUM: 'Moyen', HARD: 'Difficile' };

/** « Gérer les données de l'information » → « Données de l'information » : lisible sur les axes du radar. */
const short = (name: string) => {
  const s = name.replace(/^(Réaliser un|Gérer les|Administrer des|Optimiser des|Conduire un|Collaborer au sein d[’'](une)?) /i, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function Competences() {
  const { data, loading, error, reload } = useApi<Tree>('/skills/tree');

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Arbre de compétences' }]} />
      <PageTitle title="Arbre de compétences" subtitle="Chaque compétence du référentiel BUT est une branche : réussis des défis pour débloquer les paliers et monter de rang." />
      <PageState loading={loading} error={error} onRetry={reload}>
        {data && <TreeView tree={data} />}
      </PageState>
    </div>
  );
}

function TreeView({ tree }: { tree: Tree }) {
  return (
    <div className="space-y-6">
      <section className="grid items-center gap-6 rounded-xl bg-navy p-6 text-white lg:grid-cols-[minmax(0,360px)_1fr]">
        <Radar branches={tree.branches} />
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Maîtrise globale</p>
            <p className="text-5xl font-black">
              {tree.totals.mastery}
              <span className="text-2xl text-white/60"> %</span>
            </p>
            <p className="text-sm text-white/70">
              {tree.totals.done} défi{tree.totals.done > 1 ? 's' : ''} réussi{tree.totals.done > 1 ? 's' : ''} sur {tree.totals.total}
            </p>
          </div>

          {tree.next ? (
            <div className="rounded-lg bg-white/10 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand">
                <Target className="h-4 w-4" /> Ton prochain pas
              </p>
              <p className="mt-1 text-lg font-bold">{tree.next.title}</p>
              <p className="text-sm text-white/70">
                {short(tree.next.competence)} · palier {TIER_LABEL[tree.next.difficulty].toLowerCase()}
              </p>
              <Link to={`/defis/${tree.next.id}`} className="mt-3 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-bold text-white hover:brightness-110">
                Relever le défi <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <p className="rounded-lg bg-white/10 p-4 text-sm">Tous les défis disponibles sont réussis : bravo, il n’y a plus rien à débloquer pour l’instant.</p>
          )}
        </div>
      </section>

      <div className="space-y-4">
        {tree.branches.map((b, i) => (
          <BranchCard key={b.id} branch={b} color={COLORS[i % COLORS.length]} index={i} />
        ))}
      </div>
    </div>
  );
}

// ───────────── Radar ─────────────

function Radar({ branches }: { branches: Branch[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 150);
    return () => window.clearTimeout(t);
  }, []);

  const n = branches.length;
  const C = 150; // centre
  const R = 100; // rayon à 100 %
  const point = (i: number, ratio: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [C + Math.cos(a) * R * ratio, C + Math.sin(a) * R * ratio] as const;
  };
  const poly = (ratio: (i: number) => number) => branches.map((_, i) => point(i, ratio(i)).join(',')).join(' ');

  return (
    <svg viewBox="-40 0 380 300" className="mx-auto w-full max-w-md" role="img" aria-label="Radar de maîtrise des compétences">
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={poly(() => r)} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
      ))}
      {branches.map((_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(255,255,255,.18)" />;
      })}
      <g style={{ transformOrigin: `${C}px ${C}px`, transform: ready ? 'scale(1)' : 'scale(0)', transition: 'transform 900ms cubic-bezier(.2,.8,.2,1)' }}>
        <polygon points={poly((i) => Math.max(0.03, branches[i].value / 100))} fill="rgba(239,138,14,.35)" stroke="#ef8a0e" strokeWidth="2.5" strokeLinejoin="round" />
        {branches.map((b, i) => {
          const [x, y] = point(i, Math.max(0.03, b.value / 100));
          return <circle key={b.id} cx={x} cy={y} r="4.5" fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth="1.5" />;
        })}
      </g>
      {branches.map((b, i) => {
        const [x, y] = point(i, 1.2);
        const anchor = Math.abs(x - C) < 8 ? 'middle' : x > C ? 'start' : 'end';
        return (
          <text key={b.id} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fill="#fff" fontSize="10" fontWeight="600">
            {short(b.name).split(' ')[0]}
            <tspan x={x} dy="12" fontSize="9" fill="rgba(255,255,255,.6)" fontWeight="400">
              {b.total === 0 ? 'à venir' : `${b.value} %`}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

// ───────────── Branche ─────────────

function BranchCard({ branch: b, color, index }: { branch: Branch; color: string; index: number }) {
  const [open, setOpen] = useState(b.total > 0 && b.value < 100);
  const empty = b.total === 0;
  const R = 22;

  return (
    <section style={{ animationDelay: `${index * 80}ms`, borderColor: color }} className="viz-row overflow-hidden rounded-xl border-2 bg-white">
      <button onClick={() => !empty && setOpen((o) => !o)} aria-expanded={open} disabled={empty} className="flex w-full items-center gap-4 p-4 text-left">
        <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden>
          <circle cx="28" cy="28" r={R} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle cx="28" cy="28" r={R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * R} strokeDashoffset={2 * Math.PI * R * (1 - b.value / 100)} className="transition-[stroke-dashoffset] duration-1000" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold">{b.name}</span>
            <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: empty ? '#94a3b8' : color }}>
              {empty ? 'À venir' : b.rank.label}
            </span>
          </p>
          <p className="truncate text-xs text-muted">{b.description}</p>
          <p className="mt-0.5 text-xs font-semibold" style={{ color: empty ? '#94a3b8' : color }}>
            {empty ? 'Pas encore de défi pour cette compétence' : `${b.value} % · ${b.done} / ${b.total} défis`}
          </p>
        </div>
        {!empty && <ChevronDown className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && !empty && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4">
          {b.skills.length > 0 && (
            <ul className="grid gap-2 md:grid-cols-3" aria-label="Apprentissages critiques">
              {b.skills.map((s) => (
                <li
                  key={s.label}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${s.unlocked ? 'bg-white font-medium' : 'border-dashed border-slate-300 text-muted'}`}
                  style={s.unlocked ? { borderColor: color } : undefined}
                >
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${s.unlocked ? 'text-white' : 'bg-slate-200 text-slate-500'}`} style={s.unlocked ? { background: color } : undefined}>
                    {s.unlocked ? <Check className="h-3 w-3" /> : <Lock className="h-2.5 w-2.5" />}
                  </span>
                  <span>
                    {s.label}
                    {!s.unlocked && <span className="block text-[10px]">à {s.at} % de maîtrise</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
            {b.tiers.map((t, ti) => (
              <div key={t.difficulty} className="flex flex-1 items-stretch gap-3">
                {ti > 0 && (
                  <div className="hidden items-center md:flex" aria-hidden>
                    <ArrowRight className="h-5 w-5" style={{ color: t.unlocked ? color : '#cbd5e1' }} />
                  </div>
                )}
                <div className={`flex-1 rounded-lg border p-3 ${t.unlocked ? 'bg-white' : 'border-dashed bg-slate-100/70'}`} style={t.unlocked ? { borderColor: color } : undefined}>
                  <p className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide">
                    <span className="flex items-center gap-1.5">
                      {!t.unlocked && <Lock className="h-3.5 w-3.5 text-slate-500" />} {TIER_LABEL[t.difficulty]}
                    </span>
                    <span className="font-semibold normal-case text-muted">
                      {t.done} / {t.total}
                    </span>
                  </p>
                  <ul className="space-y-1.5">
                    {t.nodes.map((n, ni) => (
                      <li key={n.id} style={{ animationDelay: `${ni * 50}ms` }} className="viz-row">
                        <NodeLink node={n} color={color} />
                      </li>
                    ))}
                  </ul>
                  {!t.unlocked && <p className="mt-2 text-[11px] text-muted">Se débloque quand la moitié du palier précédent est réussie (tu peux quand même essayer).</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function NodeLink({ node: n, color }: { node: Node; color: string }) {
  const style =
    n.status === 'done'
      ? { background: color, borderColor: color, color: '#fff' }
      : n.status === 'available'
        ? { borderColor: color, color: '#1f2a44' }
        : undefined;
  return (
    <Link
      to={`/defis/${n.id}`}
      title={`${n.title} · ${n.points} pts · ${n.minutes} min${n.status === 'locked' ? ' · pas encore recommandé' : ''}`}
      className={`flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-transform hover:scale-[1.02] ${n.status === 'locked' ? 'border-dashed border-slate-300 bg-slate-50 text-slate-500' : n.status === 'available' ? 'bg-white' : ''}`}
      style={style}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {n.status === 'done' ? <Check className="h-4 w-4" /> : n.status === 'locked' ? <Lock className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" style={{ color }} />}
      </span>
      <span className="min-w-0 flex-1 truncate">{n.title}</span>
      <span className={`shrink-0 text-[10px] ${n.status === 'done' ? 'text-white/80' : 'text-muted'}`}>{n.points} pts</span>
    </Link>
  );
}
