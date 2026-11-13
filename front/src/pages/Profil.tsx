import { useState } from 'react';
import { Check, Pencil, Star, User as UserIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, useApi } from '../api';
import PageState from '../components/PageState';
import { formatLongDate } from '../format';
import { useMe } from '../me';
import { subjectStyles } from '../subjects';
import type { ApiUser, Competence, HistoryEntry } from '../types';
import { Breadcrumb, Card, CardTitle, ProgressBar, Toggle, buttonOutline, formatNumber } from '../components/ui';

type Tab = 'apercu' | 'badges' | 'historique' | 'competences';
type Settings = { showInRanking: boolean; acceptDuels: boolean; dailyReminder: boolean };

interface ProfileData {
  user: ApiUser;
  info: { promotion: string; group: string | null; league: string; ent: string; memberSince: string };
  stats: { solved: number; totalChallenges: number; badgesEarned: number; badgesTotal: number; bestStreak: number };
  heatmap: { weeks: number[][]; activeDays: number; totalDays: number; points: number };
  subjectProgress: { subject: keyof typeof subjectStyles; done: number; total: number }[];
  recent: HistoryEntry[];
  history: HistoryEntry[];
  badges: { name: string; earned: boolean }[];
  competences: Competence[];
  settings: Settings;
}

const heatColors = ['bg-slate-200', 'bg-amber-200', 'bg-amber-400', 'bg-brand', 'bg-amber-700'];

export default function Profil() {
  const { data, setData, loading, error, reload } = useApi<ProfileData>('/profile');
  return (
    <PageState loading={loading && !data} error={data ? null : error} onRetry={reload}>
      {data && <ProfilContent data={data} setSettings={(settings) => setData({ ...data, settings })} />}
    </PageState>
  );
}

function ProfilContent({ data, setSettings }: { data: ProfileData; setSettings: (s: Settings) => void }) {
  const { refreshMe } = useMe();
  const [tab, setTab] = useState<Tab>('apercu');
  const [saveError, setSaveError] = useState<string | null>(null);
  const { user, info, stats, heatmap, settings } = data;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'apercu', label: 'Aperçu' },
    { id: 'badges', label: `Badges ${stats.badgesEarned}/${stats.badgesTotal}` },
    { id: 'historique', label: 'Historique' },
    { id: 'competences', label: 'Compétences BUT' },
  ];

  /** Enregistre une préférence ; en cas d'échec, l'ancienne valeur est rétablie. */
  const change = async (key: keyof Settings, value: boolean) => {
    setSaveError(null);
    setSettings({ ...settings, [key]: value });
    try {
      setSettings(await api<Settings>('/me/settings', { method: 'PATCH', body: { [key]: value } }));
      refreshMe();
    } catch (e) {
      setSettings(settings);
      setSaveError(e instanceof Error ? e.message : 'Impossible d’enregistrer la préférence.');
    }
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Accueil', to: '/' }, { label: 'Mon profil' }]} />

      <section className="flex flex-col gap-6 rounded-lg bg-navy p-6 text-white md:flex-row md:items-center">
        <div className="relative shrink-0">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15">
            <UserIcon className="h-12 w-12" />
          </span>
          <button aria-label="Modifier l’avatar" disabled title="Bientôt disponible" className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-white text-navy disabled:opacity-70">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1">
          <h1 className="text-2xl font-bold">{user.firstName} {user.lastName}</h1>
          <p className="text-xs text-slate-300">
            {user.group ?? user.formation} · Membre depuis {formatLongDate(info.memberSince)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded bg-brand px-2 py-1">{user.league}</span>
            <span className="rounded bg-white/15 px-2 py-1">Rang #{user.promoRank} de la promo</span>
            <span className="rounded bg-white/15 px-2 py-1">Série : {user.streakDays} jour{user.streakDays > 1 ? 's' : ''}</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-brand">Niveau {user.level}</span>
              <span>{formatNumber(user.xp)} / {formatNumber(user.xpNextLevel)} XP</span>
            </div>
            <ProgressBar value={user.xp} max={user.xpNextLevel} color="bg-brand" track="bg-white/20" height="h-2" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ['Points', formatNumber(user.points), 'cette saison'],
            ['Défis réussis', String(stats.solved), `sur ${stats.totalChallenges}`],
            ['Badges', `${stats.badgesEarned} / ${stats.badgesTotal}`, 'débloqués'],
            ['Record de série', `${stats.bestStreak} j`, 'meilleure série'],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-md bg-white/10 px-4 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-300">{label}</p>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-[10px] text-slate-300">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200 text-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 font-medium transition-colors ${tab === t.id ? 'border-brand' : 'border-transparent text-muted hover:text-navy'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'apercu' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-5">
            <Card>
              <div className="flex items-center justify-between">
                <CardTitle>Mon activité</CardTitle>
                <span className="text-xs text-muted">12 dernières semaines</span>
              </div>
              <div className="mt-4 grid grid-flow-col grid-rows-7 gap-1.5" role="img" aria-label="Carte de chaleur de l’activité">
                {heatmap.weeks.flatMap((week, w) => week.map((level, d) => <span key={`${w}-${d}`} className={`h-5 rounded-sm ${heatColors[level]}`} />))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span><strong className="text-navy">{heatmap.activeDays} jour{heatmap.activeDays > 1 ? 's' : ''} actif{heatmap.activeDays > 1 ? 's' : ''}</strong> sur {heatmap.totalDays} · {formatNumber(heatmap.points)} pts</span>
                <span className="flex items-center gap-1">Moins {heatColors.map((c) => <span key={c} className={`h-3 w-3 rounded-sm ${c}`} />)} Plus</span>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <CardTitle>Progression par matière</CardTitle>
                <span className="text-xs text-muted">défis réussis</span>
              </div>
              <ul className="mt-4 space-y-3">
                {data.subjectProgress.map((p) => (
                  <li key={p.subject} className="grid grid-cols-[150px_1fr_50px] items-center gap-3 text-xs">
                    <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${subjectStyles[p.subject].dot}`} />{p.subject}</span>
                    <ProgressBar value={p.done} max={p.total} color={subjectStyles[p.subject].bar} track="bg-white" height="h-2" />
                    <span className="text-right font-semibold">{p.done}/{p.total}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <CardTitle>Dernières réussites</CardTitle>
                <button onClick={() => setTab('historique')} className={`${buttonOutline} px-3 py-1 text-xs`}>Tout l’historique</button>
              </div>
              <HistoryList items={data.recent} />
            </Card>
          </div>

          <aside className="space-y-5">
            <Card>
              <CardTitle>Informations</CardTitle>
              <dl className="mt-3 space-y-2 text-xs">
                {[
                  ['Promotion', info.promotion],
                  ['Groupe', info.group ?? '—'],
                  ['Ligue', info.league],
                  ['Compte ENT', info.ent],
                  ['Membre depuis', formatLongDate(info.memberSince)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
                ))}
              </dl>
            </Card>
            <Card>
              <CardTitle>Confidentialité et rappels</CardTitle>
              {saveError && <p role="alert" className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-800">{saveError}</p>}
              <ul className="mt-3 space-y-2">
                <Setting label="Apparaître dans le classement" text="Les autres étudiants voient ton nom et tes points." checked={settings.showInRanking} onChange={(v) => change('showInRanking', v)} />
                <Setting label="Invitations à un duel" text="Autoriser les camarades à te défier." checked={settings.acceptDuels} onChange={(v) => change('acceptDuels', v)} />
                <Setting label="Rappel quotidien" text="Préférence enregistrée ; l’envoi des rappels n’est pas encore actif." checked={settings.dailyReminder} onChange={(v) => change('dailyReminder', v)} />
              </ul>
            </Card>
          </aside>
        </div>
      )}

      {tab === 'badges' && (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Mes badges</CardTitle>
            <Link to="/succes" className="text-xs font-semibold text-brand hover:underline">Voir tous les succès →</Link>
          </div>
          <ul className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {data.badges.map((b) => (
              <li key={b.name} className="flex flex-col items-center gap-2 text-center text-xs">
                <span className={`flex h-14 w-14 items-center justify-center rounded-full ${b.earned ? 'bg-navy text-white' : 'bg-slate-200 text-slate-400'}`}>
                  <Star className="h-6 w-6" fill="currentColor" />
                </span>
                <span className={b.earned ? 'font-semibold' : 'text-muted'}>{b.name}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'historique' && (
        <Card>
          <CardTitle>Historique des défis réussis</CardTitle>
          <HistoryList items={data.history} />
        </Card>
      )}

      {tab === 'competences' && (
        <Card>
          <CardTitle>Compétences du référentiel BUT</CardTitle>
          <p className="text-xs text-muted">Chaque défi réussi alimente ces compétences, et donc ton portfolio.</p>
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {data.competences.map((c) => (
              <li key={c.name} className="rounded-md bg-white p-3">
                <div className="flex justify-between gap-3 text-sm"><span className="font-semibold">{c.name}</span><span className="font-semibold">{c.value} %</span></div>
                <p className="mb-2 text-xs text-muted">{c.description}</p>
                <ProgressBar value={c.value} max={100} height="h-2" track="bg-slate-200" />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function HistoryList({ items }: { items: HistoryEntry[] }) {
  if (items.length === 0) return <p className="mt-3 text-sm text-muted">Aucun défi réussi pour le moment.</p>;
  return (
    <ul className="mt-3 space-y-2">
      {items.map((h) => (
        <li key={`${h.title}-${h.date}`} className="flex items-center gap-3 rounded-md bg-white px-3 py-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white"><Check className="h-4 w-4" /></span>
          <div className="flex-1">
            <p className="text-sm font-semibold">{h.title}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className={`h-2 w-2 rounded-full ${subjectStyles[h.subject].dot}`} /> {h.subject} · {h.date} · {h.duration}
            </p>
          </div>
          <span className="text-sm font-bold text-brand">+{h.points} pts</span>
        </li>
      ))}
    </ul>
  );
}

function Setting({ label, text, checked, onChange }: { label: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
      <div>
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[11px] text-muted">{text}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </li>
  );
}
