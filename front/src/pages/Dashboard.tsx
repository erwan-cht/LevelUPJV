import HeroCard from '../components/HeroCard';
import MyChallenges from '../components/MyChallenges';
import Activity from '../components/Activity';
import Badges from '../components/Badges';
import Ranking from '../components/Ranking';
import DailyObjectives from '../components/DailyObjectives';
import DuelBanner from '../components/DuelBanner';
import PageState from '../components/PageState';
import { useApi } from '../api';
import { subjectStyles } from '../data/catalog';
import { onlinePlayers } from '../data/mock';
import type {
  ActivityDay,
  ApiChallenge,
  ApiUser,
  Badge,
  Challenge,
  DailyObjective,
  RankingEntry,
  StreakDay,
} from '../types';

interface DashboardData {
  user: ApiUser;
  challenges: ApiChallenge[];
  promoRanking: (RankingEntry & { name: string })[];
  groupRanking: (RankingEntry & { name: string })[];
  activity: ActivityDay[];
  badges: Badge[];
  nextBadge: { name: string; progress: number; total: number; unit: string };
  dailyObjectives: DailyObjective[];
  streak: StreakDay[];
  streakDays: number;
}

/** Les défis de l'API deviennent les lignes « Mes défis » du tableau de bord. */
const toDashboardChallenge = (c: ApiChallenge): Challenge => ({
  id: c.id,
  title: c.title,
  category: c.subject,
  categoryColor: subjectStyles[c.subject].dot,
  difficulty: c.difficulty,
  testsPassed: c.testsPassed ?? 0,
  testsTotal: c.tests,
  points: c.points,
  status: c.status === 'termine' ? 'termine' : c.status === 'en-cours' ? 'en-cours' : 'recommande',
});

/** Le « toi » du classement est repéré par le serveur (isMe). */
const withMe = (list: DashboardData['promoRanking']): RankingEntry[] =>
  list.map((r) => (r.isMe ? { ...r, name: `${r.name.split(' ')[0]} (toi)` } : { ...r, name: shortName(r.name) }));

const shortName = (full: string) => {
  const [first, ...rest] = full.split(' ');
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
};

export default function Dashboard() {
  const { data, loading, error, reload } = useApi<DashboardData>('/dashboard');

  return (
    <PageState loading={loading} error={error} onRetry={reload}>
      {data && <DashboardContent data={data} />}
    </PageState>
  );
}

function DashboardContent({ data }: { data: DashboardData }) {
  const challenges = data.challenges.map(toDashboardChallenge);
  const resume = data.challenges.find((c) => c.status === 'en-cours');

  return (
    <div className="space-y-5">
      <HeroCard user={data.user} resumeTitle={resume?.title ?? 'Mes défis'} resumeId={resume?.id} />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <MyChallenges challenges={challenges} />
          <Activity days={data.activity} />
          <Badges badges={data.badges} next={data.nextBadge} />
        </div>
        <aside className="min-w-0 space-y-5">
          <Ranking promo={withMe(data.promoRanking)} groupe={withMe(data.groupRanking)} />
          <DailyObjectives objectives={data.dailyObjectives} streak={data.streak} streakDays={data.streakDays} />
        </aside>
      </div>

      <DuelBanner players={onlinePlayers} />
    </div>
  );
}
