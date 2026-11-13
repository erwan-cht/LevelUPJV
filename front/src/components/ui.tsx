import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export const formatNumber = (n: number) => n.toLocaleString('fr-FR');

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg bg-panel p-5 ${className}`}>{children}</section>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

export function ProgressBar({
  value,
  max,
  color = 'bg-navy',
  track = 'bg-slate-200',
  height = 'h-1.5',
}: {
  value: number;
  max: number;
  color?: string;
  track?: string;
  height?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className={`w-full overflow-hidden rounded-full ${track} ${height}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Avatar({
  initials,
  color = 'bg-navy',
  size = 'h-7 w-7 text-[10px]',
  className = '',
}: {
  initials: string;
  color?: string;
  size?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${color} ${size} ${className}`}
    >
      {initials}
    </span>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex rounded-md bg-white p-0.5 text-xs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            value === t.id ? 'bg-navy text-white' : 'text-navy hover:bg-slate-100'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Delta({ value }: { value: number }) {
  if (value > 0) return <span className="text-xs font-semibold text-green-600">▲ {value}</span>;
  if (value < 0) return <span className="text-xs font-semibold text-red-600">▼ {-value}</span>;
  return <span className="text-xs text-muted">—</span>;
}

/* ---------- Composants partagés par les nouvelles pages ---------- */

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Fil d’Ariane" className="text-xs text-muted">
      {items.map((it, i) => (
        <span key={it.label}>
          {i > 0 && <span className="mx-1.5">›</span>}
          {it.to ? (
            <Link to={it.to} className="hover:text-brand">
              {it.label}
            </Link>
          ) : (
            <span className="font-semibold text-navy">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageTitle({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
      />
    </button>
  );
}

/** Petit groupe de boutons exclusifs (Facile / Moyen / Difficile…). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md bg-white p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={`rounded px-3 py-1.5 font-medium transition-colors ${
            value === o ? 'bg-navy text-white' : 'hover:bg-slate-100'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export const buttonPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50';
export const buttonBrand =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50';
export const buttonOutline =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-navy bg-white px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50';
export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';

export function DifficultyDots({ level }: { level: 'Facile' | 'Moyen' | 'Difficile' }) {
  const n = level === 'Facile' ? 1 : level === 'Moyen' ? 2 : 3;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 w-3 rounded-full ${i <= n ? 'bg-brand' : 'bg-slate-300'}`} />
        ))}
      </span>
      {level}
    </span>
  );
}

export function CodeBlock({ code, className = '' }: { code: string; className?: string }) {
  return (
    <pre
      className={`overflow-x-auto rounded-md bg-[#1b2238] p-4 font-mono text-xs leading-6 text-slate-100 ${className}`}
    >
      {code.split('\n').map((line, i) => (
        <div key={i} className="flex gap-4">
          <span className="w-4 shrink-0 select-none text-right text-slate-500">{i + 1}</span>
          <code className="whitespace-pre">{line}</code>
        </div>
      ))}
    </pre>
  );
}
