import { Avatar } from './ui';

export default function DuelBanner({ players }: { players: { initials: string; color: string }[] }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg bg-brand p-6 sm:flex-row sm:items-center">
      <div className="flex-1">
        <h2 className="text-lg font-bold text-navy">Duel en temps réel</h2>
        <p className="max-w-md text-xs text-navy/80">
          Affronte un camarade sur le même exercice : le plus rapide à réussir tous les tests remporte les points.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex -space-x-2">
          {players.map((p) => (
            <Avatar key={p.initials} initials={p.initials} color={p.color} className="ring-2 ring-brand" />
          ))}
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-navy">
          <span className="h-2 w-2 rounded-full bg-green-600" />
          {players.length} en ligne
        </span>
        <button className="rounded bg-navy px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-navy-light">
          Lancer un duel
        </button>
      </div>
    </section>
  );
}
