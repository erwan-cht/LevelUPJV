import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { notions, studentsToHelp, teacherAlert, teacherCompetences, teacherStats } from '../../data/teacher';
import { subjectStyles, subjects } from '../../data/catalog';
import { Avatar, Breadcrumb, PageTitle, ProgressBar, Segmented, buttonBrand, inputClass } from '../../components/ui';

const tagStyle = { inactif: 'bg-red-100 text-red-700', bloqué: 'bg-red-100 text-red-700', 'à suivre': 'bg-brand-light text-brand' } as const;

const barColor = (rate: number) => (rate < 45 ? 'bg-red-600' : rate < 65 ? 'bg-brand' : 'bg-green-600');

export default function MesPromos() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'Toutes' | (typeof subjects)[number]>('Toutes');
  const [promo, setPromo] = useState('BUT 2 Informatique');
  const [group, setGroup] = useState('Tous les groupes');
  const [period, setPeriod] = useState('7 derniers jours');
  const [launch, setLaunch] = useState({ notion: notions[0].title, group: 'Groupe 2', duration: '30 minutes', mode: 'Individuel' as 'Individuel' | 'Duels par équipes' });
  const [launched, setLaunched] = useState(false);

  const rows = notions.filter((n) => filter === 'Toutes' || n.subject === filter);

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/enseignant' }, { label: 'Mes promos' }]} />

      <PageTitle title="Tableau de bord enseignant" subtitle="Où la promo bloque, et comment la relancer en TD.">
        <div className="flex flex-wrap gap-2 text-xs">
          <Pick value={promo} onChange={setPromo} options={['BUT 1 Informatique', 'BUT 2 Informatique', 'BUT 3 Informatique']} label="Promotion" />
          <Pick value={group} onChange={setGroup} options={['Tous les groupes', 'Groupe 1', 'Groupe 2', 'Groupe 3']} label="Groupe" />
          <Pick value={period} onChange={setPeriod} options={['7 derniers jours', '30 derniers jours', 'Semestre']} label="Période" />
        </div>
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {teacherStats.map((s) => (
          <div key={s.label} className={`rounded-lg border-t-4 bg-white p-4 shadow-sm ${s.border}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{s.label}</p>
            <p className="mt-1 text-3xl font-bold">{s.value} <span className="text-sm font-normal text-muted">{s.suffix}</span></p>
            <p className={`text-xs font-semibold ${s.tone}`}>{s.trend}</p>
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
                    {s === 'Toutes' ? 'Toutes' : s}
                  </button>
                ))}
              </div>

              <ul className="divide-y divide-slate-100">
                {rows.map((n) => (
                  <li key={n.title} className="grid grid-cols-[1fr_auto] items-center gap-3 py-2.5 md:grid-cols-[210px_1fr_44px_46px_auto]">
                    <div>
                      <p className="text-sm font-semibold">{n.title}</p>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white ${subjectStyles[n.subject].bar}`}>{subjectStyles[n.subject].short}</span>
                    </div>
                    <div className="hidden md:block"><ProgressBar value={n.successRate} max={100} color={barColor(n.successRate)} height="h-2" /></div>
                    <span className={`hidden text-right text-xs font-bold md:block ${n.successRate < 45 ? 'text-red-600' : n.successRate < 65 ? 'text-brand' : 'text-green-600'}`}>{n.successRate} %</span>
                    <span className="hidden text-right text-xs text-muted md:block">{n.attempts}<br /><span className="text-[9px]">tentatives</span></span>
                    <button onClick={() => setLaunch((l) => ({ ...l, notion: n.title }))} className="rounded border border-navy px-3 py-1.5 text-xs font-medium hover:bg-slate-50">Challenge TD</button>
                  </li>
                ))}
              </ul>

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
              {teacherCompetences.map((c) => (
                <li key={c.name}>
                  <div className="flex justify-between text-sm font-semibold"><span>{c.name}</span><span className="text-xs">{c.value} %</span></div>
                  <p className="mb-1 text-[11px] text-muted">{c.description}</p>
                  <ProgressBar value={c.value} max={100} height="h-2" />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="overflow-hidden rounded-lg border border-brand bg-white">
            <h2 className="bg-brand px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white">Lancer un challenge en TD</h2>
            <form
              className="space-y-3 p-4 text-xs"
              onSubmit={(e) => { e.preventDefault(); setLaunched(true); window.setTimeout(() => setLaunched(false), 3000); }}
            >
              <Field label="Notion à travailler">
                <select className={inputClass} value={launch.notion} onChange={(e) => setLaunch({ ...launch, notion: e.target.value })}>
                  {notions.map((n) => <option key={n.title}>{n.title}</option>)}
                </select>
              </Field>
              <Field label="Groupe">
                <select className={inputClass} value={launch.group} onChange={(e) => setLaunch({ ...launch, group: e.target.value })}>
                  {['Groupe 1', 'Groupe 2', 'Groupe 3'].map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Durée">
                <select className={inputClass} value={launch.duration} onChange={(e) => setLaunch({ ...launch, duration: e.target.value })}>
                  {['15 minutes', '30 minutes', '45 minutes'].map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Mode">
                <Segmented<'Individuel' | 'Duels par équipes'> options={['Individuel', 'Duels par équipes']} value={launch.mode} onChange={(mode) => setLaunch({ ...launch, mode })} />
              </Field>
              <button type="submit" className={`${buttonBrand} w-full`}>Lancer le challenge</button>
              {launched && <p role="status" className="rounded bg-green-100 px-3 py-2 text-green-800">Challenge « {launch.notion} » lancé pour le {launch.group}.</p>}
            </form>
          </section>

          <section className="overflow-hidden rounded-lg border border-sky-600 bg-white">
            <div className="flex items-center justify-between bg-sky-600 px-4 py-2 text-white">
              <h2 className="text-xs font-semibold uppercase tracking-wide">Étudiants à accompagner</h2>
              <span className="text-[11px]">4 sur 7</span>
            </div>
            <ul className="space-y-1 p-3">
              {studentsToHelp.map((s) => (
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
            <p className="m-3 mt-0 rounded bg-sky-50 p-3 text-xs italic text-muted">{teacherAlert}</p>
            <button onClick={() => navigate('/enseignant/challenges')} className="m-3 mt-0 text-xs font-semibold text-brand hover:underline">Préparer un nouveau défi →</button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Pick({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs focus:border-brand focus:outline-none">
      {options.map((o) => <option key={o}>{o}</option>)}
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
