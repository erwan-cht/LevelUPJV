import { useEffect } from 'react';
import { bigConfetti } from './confetti';
import Mascot from './Mascot';
import { sfx } from './sound';

/** « Niveau supérieur ! » : la mascotte fête le passage de niveau (se ferme seule, ou d'un clic / Échap). */
export default function LevelUp({ level, onClose }: { level: number; onClose: () => void }) {
  useEffect(() => {
    bigConfetti();
    sfx.levelUp();
    const t = window.setTimeout(onClose, 6000);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Niveau ${level} atteint`} onClick={onClose} className="fx-fade-in fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4">
      <div className="fx-pop-in relative w-full max-w-sm rounded-3xl bg-white px-8 pb-8 pt-4 text-center shadow-2xl">
        <Mascot pose="cheer" className="mx-auto -mt-16 h-44 w-44 drop-shadow-xl" />
        <p className="mt-2 text-sm font-bold uppercase tracking-widest text-brand">Niveau supérieur</p>
        <p className="text-7xl font-black text-navy">{level}</p>
        <p className="mt-1 text-sm text-muted">Bravo, tu progresses ! Continue comme ça.</p>
        <button onClick={onClose} className="mt-5 rounded-lg bg-brand px-6 py-2 text-sm font-bold text-white">
          Merci !
        </button>
      </div>
    </div>
  );
}
