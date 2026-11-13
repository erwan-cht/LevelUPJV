import { useState } from 'react';
import { useApi } from '../../api';
import PageState from '../../components/PageState';
import { Breadcrumb, Card, PageTitle, ProgressBar } from '../../components/ui';

interface Data {
  promotion: string | null;
  group: string | null;
  filters: { id: number; name: string; groups: { id: number; name: string }[] }[];
  selected: { promoId: number | null; groupId: number | null };
  items: { name: string; description: string; value: number; skills: string[] }[];
}

export default function Competences() {
  const [promoId, setPromoId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);

  const query = new URLSearchParams();
  if (promoId) query.set('promoId', String(promoId));
  if (groupId) query.set('groupId', String(groupId));
  const { data, loading, error, reload } = useApi<Data>(`/teacher/competences?${query}`);
  const promo = data?.filters.find((p) => p.id === data.selected.promoId);

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Mes promos', to: '/enseignant' }, { label: 'Compétences' }]} />
      <PageTitle
        title="Compétences du référentiel BUT"
        subtitle={
          data?.promotion
            ? `Acquisition moyenne de la promo ${data.promotion}${data.group ? ` · ${data.group}` : ''}, alimentée par les défis réussis.`
            : 'Acquisition moyenne de la promo, alimentée par les défis réussis.'
        }
      >
        {data && (
          <div className="flex flex-wrap gap-2 text-xs">
            <select
              aria-label="Promotion"
              value={data.selected.promoId ?? ''}
              onChange={(e) => {
                setPromoId(Number(e.target.value));
                setGroupId(null);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-brand focus:outline-none"
            >
              {data.filters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              aria-label="Groupe"
              value={data.selected.groupId ?? ''}
              onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-brand focus:outline-none"
            >
              <option value="">Tous les groupes</option>
              {(promo?.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
      </PageTitle>

      <PageState loading={loading && !data} error={data ? null : error} onRetry={reload}>
        <div className={`grid gap-4 md:grid-cols-2 ${loading ? 'opacity-60' : ''}`}>
          {data?.items.map((c) => (
            <Card key={c.name}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <span className="text-lg font-bold text-brand">{c.value} %</span>
              </div>
              <p className="mb-2 text-xs text-muted">{c.description}</p>
              <ProgressBar value={c.value} max={100} height="h-2" track="bg-white" />
              {c.skills.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-4 text-xs marker:text-brand">
                  {c.skills.map((d) => <li key={d}>{d}</li>)}
                </ul>
              )}
            </Card>
          ))}
          {data?.items.length === 0 && <p className="rounded-lg bg-panel p-6 text-center text-sm text-muted md:col-span-2">Le référentiel est vide.</p>}
        </div>
      </PageState>
    </div>
  );
}
