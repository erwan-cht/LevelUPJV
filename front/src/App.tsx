import Header from './components/Header';
import HeroCard from './components/HeroCard';
import MyChallenges from './components/MyChallenges';
import Activity from './components/Activity';
import Badges from './components/Badges';
import Ranking from './components/Ranking';
import DailyObjectives from './components/DailyObjectives';
import DuelBanner from './components/DuelBanner';
import {
  activity,
  badges,
  challenges,
  currentUser,
  dailyObjectives,
  groupRanking,
  nextBadge,
  onlinePlayers,
  promoRanking,
  streak,
  streakDays,
} from './data/mock';

export default function App() {
  const resume = challenges.find((c) => c.status === 'en-cours' && c.testsPassed > 0);

  return (
    <>
      <Header points={currentUser.points} />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <HeroCard user={currentUser} resumeTitle={resume?.title ?? 'Mes défis'} />

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-5">
            <MyChallenges challenges={challenges} />
            <Activity days={activity} />
            <Badges badges={badges} next={nextBadge} />
          </div>
          <aside className="min-w-0 space-y-5">
            <Ranking promo={promoRanking} groupe={groupRanking} />
            <DailyObjectives objectives={dailyObjectives} streak={streak} streakDays={streakDays} />
          </aside>
        </div>

        <DuelBanner players={onlinePlayers} />
      </main>
    </>
  );
}
