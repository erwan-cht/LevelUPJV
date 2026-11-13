import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useApi } from '../../api';
import PageState from '../../components/PageState';
import { subjectStyles, subjects } from '../../subjects';
import type { Competence, Subject } from '../../types';
import { Avatar, Breadcrumb, PageTitle, ProgressBar, buttonBrand, inputClass } from '../../components/ui';

interface Overview {
  filters: { id: number; name: string; groups: { id: number; name: string }[] }[];
  selected: { promoId: number | null; groupId: number | null; period: number };
  students: number;
  stats: { label: string; value: string; suffix: string; trend: string; tone: 'good' | 'bad' | 'flat' }[];
  notions: { id: number; title: string; subject: Subject; successRate: number; attempts: number }[];
  toHelp: { items: { name: string; initials: string; tag: 'inactif' | 'bloqué' | 'à suivre'; info: string }[]; total: number };
  alert: string;
  competences: Competence[];
  challenges: { id: number; title: string; subject: Subject }[];
}

const tagStyle = { inactif: 'bg-red-100 text-red-700', bloqué: 'bg-red-100 text-red-700', 'à suivre': 'bg-brand-light text-brand' } as const;
const toneStyle = { good: 'text-green-600', bad: 'text-red-600', flat: 'text-muted' } as const;
const statBorder = ['border-t-sky-600', 'border-t-brand', 'border-t-green-600', 'border-t-red-600'];
const periods = [
  { days: 7, label: '7 derniers jours' },
  { days: 30, label: '30 derniers jours' },
  { days: 180, label: 'Semestre' },
];

const barColor = (rate: number) => (rate < 45 ? 'bg-red-600' : rate < 65 ? 'bg-brand' : 'bg-green-600');

export default function MesPromos() {
  const [promoId, setPromoId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [period, setPeriod] = useState(7);

  const query = new URLSearchParams({ period: String(period) });
  if (promoId) query.set('promoId', String(promoId));
  if (groupId) query.set('groupId', String(groupId));
  const { data, loading, error, reload } = useApi<Overview>(`/teacher/overview?${query}`);

  return (
    <PageState loading={loading && !data} error={data ? null : error} onRetry={reload}>
      {data && (
        <Content
          data={data}
          refreshing={loading}
          setPromo={(id) => {
            setPromoId(id);
            setGroupId(null);
          }}
          setGroup={setGroupId}
          setPeriod={setPeriod}
        />
      )}
    </PageState>
  );
}

function Content({
  data,
  refreshing,
  setPromo,
  setGroup,
  setPeriod,
}: {
  data: Overview;
  refreshing: boolean;
  setPromo: (id: number) => void;
  setGroup: (id: number | null) => void;
  setPeriod: (days: number) => void;
}) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'Toutes' | Subject>('Toutes');
  const promo = data.filters.find((p) => p.id === data.selected.promoId);

  const [launch, setLaunch] = useState({ challengeId: 0, target: 'promo', duration: 30 });
  const [launched, setLaunched] = useState<{ ok: boolean; text: string } | null>(null);
  const challengeId = launch.challengeId || data.challenges[0]?.id || 0;

  const rows = data.notions.filter((n) => filter === 'Toutes' || n.subject === filter);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaunched(null);
    try {
      const res = await api<{ target: string; title: string }>('/teacher/assignments', {
        body: {
          challengeId,
          durationMin: launch.duration,
          ...(launch.target === 'promo' ? { promoId: promo?.id } : { groupId: Number(launch.target) }),
        },
      });
      setLaunched({ ok: true, text: `Challenge « ${res.title} » proposé à ${res.target}. Il apparaît dans les défis recommandés des étudiants.` });
    } catch (err) {
      setLaunched({ ok: false, text: err instanceof Error ? err.message : 'Impossible de lancer le challenge.' });
    }
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/enseignant' }, { label: 'Mes promos' }]} />

      <PageTitle title="Tableau de bord enseignant" subtitle="Où la promo bloque, et comment la relancer en TD.">
        <div className="flex flex-wrap gap-2 text-xs">
          <Pick value={String(data.selected.promoId ?? '')} onChange={(v) => setPromo(Number(v))} label="Promotion" options={data.filters.map((p) => [String(p.id), p.name])} />
          <Pick
            value={String(data.selected.groupId ?? '')}
            onChange={(v) => setGroup(v ? Number(v) : null)}
            label="Groupe"
            options={[['', 'Tous les groupes'], ...(promo?.groups ?? []).map((g): [string, string] => [String(g.id), g.name])]}
          />
          <Pick value={String(data.selected.period)} onChange={(v) => setPeriod(Number(v))} label="Période" options={periods.map((p) => [String(p.days), p.label])} />
        </div>
      </PageTitle>

      {data.filters.length === 0 && (
        <p className="rounded-lg bg-panel p-6 text-center text-sm text-muted">Aucune promotion n’existe encore : demande à un administrateur d’en créer une.</p>
      )}

      <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${refreshing ? 'opacity-60' : ''}`}>
        {data.stats.map((s, i) => (
          <div key={s.label} className={`rounded-lg border-t-4 bg-white p-4 shadow-sm ${statBorder[i]}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{s.label}</p>
            <p className="mt-1 text-3xl font-bold">{s.value} <span className="text-sm font-normal text-muted">{s.suffix}</span></p>
            <p className={`text-xs font-semibold ${toneStyle[s.tone]}`}>{s.trend}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-lg border border-red-600 bg-white">
            <div className="flex items-center justify-between bg-red-600 px-4 py-2 text-white">
              <h2 className="text-xs font-semibold uppercase tracking-wide">Notions où la promo bloque</h2>
              <span className="text-[11px]">triées par taux de réussite</span>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap gap-1.5 text-xs">
                {(['Toutes', ...subjects] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    aria-pressed={filter === s}
                    className={`rounded border px-3 py-1 font-medium ${filter === s ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {rows.length === 0 ? (
                <p className="py-4 text-sm text-muted">Aucune tentative sur cette période pour ce filtre.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {rows.map((n) => (
                    <li key={n.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5 md:grid-cols-[210px_1fr_44px_46px_auto]">
                      <div>
                        <p className="text-sm font-semibold">{n.title}</p>
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white ${subjectStyles[n.subject].bar}`}>{subjectStyles[n.subject].short}</span>
                      </div>
                      <div className="hidden md:block"><ProgressBar value={n.successRate} max={100} color={barColor(n.successRate)} height="h-2" /></div>
                      <span className={`hidden text-right text-xs font-bold md:block ${n.successRate < 45 ? 'text-red-600' : n.successRate < 65 ? 'text-brand' : 'text-green-600'}`}>{n.successRate} %</span>
                      <span className="hidden text-right text-xs text-muted md:block">{n.attempts}<br /><span className="text-[9px]">tentatives</span></span>
                      <button onClick={() => setLaunch((l) => ({ ...l, challengeId: n.id }))} className="rounded border border-navy px-3 py-1.5 text-xs font-medium hover:bg-slate-50">Challenge TD</button>
                    </li>
                  ))}
                </ul>
              )}

              <p className="flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-[11px] text-muted">
                <Legend color="bg-red-600" text="Moins de 45 % : à retravailler en TD" />
                <Legend color="bg-brand" text="45 à 65 % : à surveiller" />
                <Legend color="bg-green-600" text="Plus de 65 % : acquis" />
              </p>
            </div>
          </section>

          <section id="competences" className="overflow-hidden rounded-lg bg-navy text-white">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide">Compétences du référentiel BUT</h2>
              <Link to="/enseignant/competences" className="text-[11px] text-slate-300 hover:text-white">acquisition moyenne de la promo →</Link>
            </div>
            <ul className="grid gap-x-8 gap-y-4 bg-white p-4 text-navy md:grid-cols-2">
              {data.competences.map((c) => (
                <li key={c.name}>
                  <div className="flex justify-between gap-3 text-sm font-semibold"><span>{c.name}</span><span className="text-xs">{c.value} %</span></div>
                  <p className="mb-1 text-[11px] text-muted">{c.description}</p>
                  <ProgressBar value={c.value} max={100} height="h-2" />
                </li>
              ))}
              {data.competences.length === 0 && <li className="text-sm text-muted">Le référentiel est vide.</li>}
            </ul>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-lg border border-brand bg-white">
            <h2 className="bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">Lancer un challenge en TD</h2>
            <form className="space-y-3 p-4 text-xs" onSubmit={submit}>
              <Field label="Notion à travailler">
                <select className={inputClass} value={challengeId} onChange={(e) => setLaunch({ ...launch, challengeId: Number(e.target.value) })}>
                  {data.challenges.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </Field>
              <Field label="Pour">
                <select className={inputClass} value={launch.target} onChange={(e) => setLaunch({ ...launch, target: e.target.value })}>
                  <option value="promo">Toute la promo {promo?.name ?? ''}</option>
                  {(promo?.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </Field>
              <Field label="Durée conseillée">
                <select className={inputClass} value={launch.duration} onChange={(e) => setLaunch({ ...launch, duration: Number(e.target.value) })}>
                  {[15, 30, 45].map((d) => <option key={d} value={d}>{d} minutes</option>)}
                </select>
              </Field>
              <button type="submit" disabled={!challengeId || !promo} className={`${buttonBrand} w-full`}>Lancer le challenge</button>
              {launched && (
                <p role="status" className={`rounded px-3 py-2 ${launched.ok ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-800'}`}>{launched.text}</p>
              )}
            </form>
          </section>

          <section className="overflow-hidden rounded-lg border border-sky-600 bg-white">
            <div className="flex items-center justify-between bg-sky-600 px-4 py-2 text-white">
              <h2 className="text-xs font-semibold uppercase tracking-wide">Étudiants à accompagner</h2>
              <span className="text-[11px]">{data.toHelp.items.length} sur {data.toHelp.total}</span>
            </div>
            {data.toHelp.items.length === 0 ? (
              <p className="p-4 text-sm text-muted">Personne à accompagner pour le moment.</p>
            ) : (
              <ul className="space-y-1 p-3">
                {data.toHelp.items.map((s) => (
                  <li key={s.name} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-panel">
                    <Avatar initials={s.initials} size="h-8 w-8 text-xs" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{s.name}</p>
                      <p className="text-[11px] text-muted">{s.info}</p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${tagStyle[s.tag]}`}>{s.tag}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="m-3 mt-0 rounded bg-sky-50 p-3 text-xs italic text-muted">{data.alert}</p>
            <button onClick={() => navigate('/enseignant/challenges')} className="m-3 mt-0 text-xs font-semibold text-brand hover:underline">Préparer un nouveau défi →</button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Pick({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: [string, string][]; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:border-brand focus:outline-none">
      {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-medium">{label}</p>
      {children}
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${color}`} />{text}</span>;
}
