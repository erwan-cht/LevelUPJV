import type { ReactNode } from 'react';

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
