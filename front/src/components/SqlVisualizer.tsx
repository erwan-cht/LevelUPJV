import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronLeft, ChevronRight, Flag, Pause, Play, RotateCcw, X } from 'lucide-react';

// ───────────── Types (reflet de back/src/sqlsteps.ts) ─────────────

export type StepKind = 'from' | 'join' | 'where' | 'group' | 'having' | 'select' | 'order';

export interface VizTable {
  name: string;
  alias: string;
  columns: string[];
  rows: string[][];
  total: number;
}

export interface VizGroup {
  key: string[];
  rows: number[];
  n: number;
  keep?: boolean;
}

export interface VizStep {
  kind: StepKind;
  title: string;
  sql: string;
  explain: string;
  tables?: VizTable[];
  columns?: string[];
  rows?: string[][];
  keep?: boolean[];
  groupCols?: string[];
  groups?: VizGroup[];
  total?: number;
  truncated?: boolean;
}

export interface VizResult {
  supported: boolean;
  reason?: string;
  error?: string;
  steps: VizStep[];
  passed?: boolean;
  message?: string;
  divergeAt?: number | null;
  divergeNote?: string;
  expectedStep?: VizStep;
}

export interface TutorReply {
  text: string;
  /** « ai » : généré par le modèle ; « rules » : conseil construit sans IA. */
  source: 'ai' | 'rules';
  stepIndex: number;
}

// ───────────── Briques d'affichage ─────────────

const ALIAS_COLORS = ['bg-sky-100 text-sky-900', 'bg-emerald-100 text-emerald-900', 'bg-violet-100 text-violet-900', 'bg-amber-100 text-amber-900'];

/** Délai d'apparition d'une ligne : l'écran se remplit ligne par ligne. */
const stagger = (i: number, base = 0) => ({ animationDelay: `${base + i * 70}ms` });

function Grid({
  columns,
  rows,
  states,
  settled,
}: {
  columns: string[];
  rows: string[][];
  /** Pour chaque ligne : true = conservée, false = éliminée. */
  states?: boolean[];
  /** Les éliminées sont barrées une fois l'animation de tri terminée. */
  settled?: boolean;
}) {
  // Une couleur par table d'origine (colonnes « alias.colonne »).
  const aliases = [...new Set(columns.map((c) => (c.includes('.') ? c.split('.')[0] : '')))];
  const tone = (c: string) => (c.includes('.') && aliases.length > 1 ? ALIAS_COLORS[aliases.indexOf(c.split('.')[0]) % ALIAS_COLORS.length] : 'bg-slate-100');

  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className={`px-3 py-1.5 font-semibold ${tone(c)}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const dropped = states ? !states[i] : false;
            return (
              <tr
                key={i}
                style={stagger(i)}
                className={`viz-row border-t border-slate-200 transition-all duration-700 ${
                  states && settled ? (dropped ? 'bg-red-50 text-red-400 line-through opacity-50' : 'bg-emerald-50') : ''
                }`}
              >
                {r.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={Math.max(columns.length, 1)} className="px-3 py-2 text-muted">
                Aucune ligne.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Groups({ step, settled }: { step: VizStep; settled: boolean }) {
  const cols = step.columns ?? [];
  const rows = step.rows ?? [];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {(step.groups ?? []).map((g, i) => {
        const dropped = settled && g.keep === false;
        return (
          <div
            key={i}
            style={stagger(i, 100)}
            className={`viz-row overflow-hidden rounded-lg border-2 bg-white transition-all duration-700 ${
              dropped ? 'border-red-300 opacity-45' : 'border-navy/60'
            }`}
          >
            <div className={`flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-white ${dropped ? 'bg-red-400' : 'bg-navy'}`}>
              <span className={dropped ? 'line-through' : ''}>{g.key.join(' · ')}</span>
              <span className="rounded-full bg-white/20 px-2">×{g.n}</span>
            </div>
            <ul className="divide-y divide-slate-100 text-[11px]">
              {g.rows.slice(0, 4).map((ri, k) => (
                <li key={ri} style={stagger(k, 250 + i * 120)} className="viz-row truncate px-3 py-1 text-muted" title={(rows[ri] ?? []).join(' · ')}>
                  {(rows[ri] ?? []).slice(0, Math.max(cols.length, 3)).join(' · ')}
                </li>
              ))}
              {g.n > 4 && <li className="px-3 py-1 text-muted">… et {g.n - 4} autre(s)</li>}
            </ul>
            {dropped && <p className="bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-600">Éliminé par le HAVING</p>}
          </div>
        );
      })}
    </div>
  );
}

function FromTables({ tables }: { tables: VizTable[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tables.map((t, i) => (
        <div key={t.alias + i} style={stagger(i, 0)} className="viz-row">
          <p className="mb-1 text-xs font-semibold">
            {t.name}
            {t.alias !== t.name && <span className="font-normal text-muted"> (alias {t.alias})</span>}
            <span className="ml-2 font-normal text-muted">{t.total} ligne(s)</span>
          </p>
          <Grid columns={t.columns} rows={t.rows} />
        </div>
      ))}
    </div>
  );
}

/** Version « table » d'une étape, pour l'afficher côte à côte avec la solution. */
function asTable(step: VizStep): { columns: string[]; rows: string[][] } {
  if (step.kind === 'from') return { columns: ['table'], rows: (step.tables ?? []).map((t) => [t.name]) };
  if (step.kind === 'group' || step.kind === 'having') {
    const groups = (step.groups ?? []).filter((g) => step.kind === 'group' || g.keep);
    return { columns: [...(step.groupCols ?? ['groupe']), 'lignes'], rows: groups.map((g) => [...g.key, String(g.n)]) };
  }
  if (step.kind === 'where') return { columns: step.columns ?? [], rows: (step.rows ?? []).filter((_, i) => step.keep?.[i]) };
  return { columns: step.columns ?? [], rows: step.rows ?? [] };
}

function StepView({ step, settled }: { step: VizStep; settled: boolean }) {
  if (step.kind === 'from') return <FromTables tables={step.tables ?? []} />;
  if (step.kind === 'group' || step.kind === 'having') return <Groups step={step} settled={settled} />;
  return <Grid columns={step.columns ?? []} rows={step.rows ?? []} states={step.kind === 'where' ? step.keep : undefined} settled={settled} />;
}

// ───────────── Composant principal ─────────────

export default function SqlVisualizer({
  result,
  onClose,
  onAskTutor,
}: {
  result: VizResult;
  onClose: () => void;
  /** Demande un conseil au tuteur ; absent : pas de bouton. */
  onAskTutor?: () => Promise<TutorReply | null>;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [settled, setSettled] = useState(false);
  const root = useRef<HTMLElement>(null);
  const [tutor, setTutor] = useState<TutorReply | null>(null);
  const [asking, setAsking] = useState(false);
  const [tutorError, setTutorError] = useState('');
  const steps = result.steps;
  const step = steps[index];

  // La visualisation s'ouvre sous le résultat : on l'amène à l'écran.
  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }, []);

  // À chaque nouvelle étape : l'écran se remplit, puis les lignes / groupes éliminés sont barrés.
  const rowCount = step ? (step.rows?.length ?? step.groups?.length ?? 1) : 0;
  const settleDelay = 700 + rowCount * 70;
  useEffect(() => {
    setSettled(false);
    const t = window.setTimeout(() => setSettled(true), settleDelay);
    return () => window.clearTimeout(t);
  }, [index, settleDelay]);

  // Lecture automatique : on passe à l'étape suivante une fois l'animation terminée et lue.
  useEffect(() => {
    if (!playing || index >= steps.length - 1) return;
    const t = window.setTimeout(() => setIndex((i) => i + 1), settleDelay + 2600);
    return () => window.clearTimeout(t);
  }, [playing, index, steps.length, settleDelay]);

  // Dès qu'une divergence existe, on la montre à la fin de la lecture plutôt que de laisser l'élève la chercher.
  const diverge = result.divergeAt ?? null;
  const isDiverge = diverge === index;
  const expected = useMemo(() => (isDiverge && result.expectedStep ? asTable(result.expectedStep) : null), [isDiverge, result.expectedStep]);

  // Le tuteur répond, puis l'animation saute à l'étape qu'il désigne.
  const askTutor = async () => {
    if (!onAskTutor) return;
    setAsking(true);
    setTutorError('');
    try {
      const reply = await onAskTutor();
      if (reply) {
        setTutor(reply);
        setPlaying(false);
        setIndex(reply.stepIndex);
      }
    } catch (e) {
      setTutorError(e instanceof Error ? e.message : 'Le tuteur est indisponible.');
    } finally {
      setAsking(false);
    }
  };
  const canAsk = Boolean(onAskTutor) && result.passed === false && diverge !== null;

  const header = (
    <div className="flex items-center justify-between bg-navy px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">
      <span>Visualisation de l’exécution</span>
      <button onClick={onClose} aria-label="Fermer la visualisation" className="rounded p-0.5 hover:bg-white/20">
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  if (!result.supported || result.error || !step) {
    return (
      <section className="overflow-hidden rounded-lg border border-navy bg-white">
        {header}
        <p className="p-4 text-sm text-muted">{result.error ?? result.reason ?? 'Rien à visualiser pour cette requête.'}</p>
      </section>
    );
  }

  const last = index === steps.length - 1;

  return (
    <section ref={root} className="overflow-hidden rounded-lg border border-navy bg-white">
      {header}

      <div className="space-y-4 p-4">
        {/* Frise des étapes */}
        <ol className="flex flex-wrap items-center gap-1.5" aria-label="Étapes de la requête">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setPlaying(false);
                  setIndex(i);
                }}
                aria-current={i === index ? 'step' : undefined}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  i === index ? 'bg-navy text-white' : i < index ? 'bg-navy/15 text-navy' : 'bg-slate-100 text-muted'
                } ${diverge === i ? 'ring-2 ring-brand' : ''}`}
              >
                {diverge === i && <Flag className="h-3 w-3 text-brand" />}
                {s.title}
              </button>
              {i < steps.length - 1 && <span className="text-slate-300">›</span>}
            </li>
          ))}
        </ol>

        {/* Tuteur IA */}
        {canAsk && !tutor && (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={askTutor} disabled={asking} className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
              <Bot className="h-4 w-4" /> {asking ? 'Le tuteur regarde ta requête…' : 'Demander au tuteur'}
            </button>
            <span className="text-xs text-muted">Il repère l’étape qui coince, sans te donner la réponse.</span>
          </div>
        )}
        {tutorError && (
          <p role="alert" className="rounded bg-red-100 px-3 py-2 text-xs text-red-800">
            {tutorError}
          </p>
        )}
        {tutor && (
          <div role="status" className="viz-row flex gap-3 rounded-lg border border-navy/30 bg-panel p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-white">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {tutor.source === 'ai' ? 'Tuteur IA' : 'Conseil automatique'} · étape {steps[tutor.stepIndex]?.title}
              </p>
              <p className="whitespace-pre-line">{tutor.text}</p>
              {index !== tutor.stepIndex && (
                <button
                  onClick={() => {
                    setPlaying(false);
                    setIndex(tutor.stepIndex);
                  }}
                  className="mt-1 text-xs font-semibold text-brand hover:underline"
                >
                  Aller à cette étape →
                </button>
              )}
            </div>
          </div>
        )}

        {/* Commandes */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { setPlaying(false); setIndex((i) => Math.max(0, i - 1)); }} disabled={index === 0} aria-label="Étape précédente" className="rounded border border-slate-300 p-1.5 disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (last) setIndex(0);
              setPlaying((p) => (last ? true : !p));
            }}
            aria-label={playing ? 'Pause' : last ? 'Rejouer' : 'Lecture'}
            className="rounded border border-navy bg-navy p-1.5 text-white"
          >
            {playing && !last ? <Pause className="h-4 w-4" /> : last ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={() => { setPlaying(false); setIndex((i) => Math.min(steps.length - 1, i + 1)); }} disabled={last} aria-label="Étape suivante" className="rounded border border-slate-300 p-1.5 disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-1 text-xs text-muted">
            Étape {index + 1} / {steps.length}
          </span>
        </div>

        {/* Étape courante : `key` relance l'animation à chaque changement */}
        <div key={index} className="space-y-3">
          <code className="viz-row block rounded bg-[#1b2238] px-3 py-2 font-mono text-xs text-slate-100">{step.sql}</code>
          <p className="viz-row text-sm" style={stagger(1)}>{step.explain}</p>
          <StepView step={step} settled={settled} />
          {step.truncated && <p className="text-[11px] italic text-muted">Aperçu limité aux {step.rows?.length} premières lignes sur {step.total}.</p>}
        </div>

        {/* Divergence avec la solution */}
        {isDiverge && (
          <div role="status" className="viz-row rounded-lg border-2 border-brand bg-brand-light p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-navy">
              <Flag className="h-4 w-4 text-brand" /> C’est ici que ta requête s’écarte du résultat attendu
            </p>
            {result.divergeNote && <p className="mt-1 text-sm">{result.divergeNote}</p>}
            {expected && (
              <div className="mt-2">
                <p className="mb-1 text-xs font-semibold uppercase text-muted">Attendu à cette étape</p>
                <Grid columns={expected.columns} rows={expected.rows} />
              </div>
            )}
          </div>
        )}
        {last && result.passed && (
          <p role="status" className="viz-row rounded-lg bg-green-100 px-3 py-2 text-sm font-semibold text-green-800">
            Bravo, chaque étape correspond à celle de la solution.
          </p>
        )}
        {last && result.passed === false && diverge === null && result.message && (
          <p role="status" className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800">{result.message}</p>
        )}
      </div>
    </section>
  );
}
