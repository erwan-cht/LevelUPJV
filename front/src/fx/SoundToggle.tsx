import { useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isMuted, onMutedChange, setMuted, sfx } from './sound';

/** Bouton pour couper / remettre les effets sonores (réglage mémorisé). */
export default function SoundToggle() {
  const muted = useSyncExternalStore(onMutedChange, isMuted);
  return (
    <button
      onClick={() => {
        setMuted(!muted);
        if (muted) sfx.pop(); // un petit son confirme que le son est revenu
      }}
      aria-pressed={!muted}
      aria-label={muted ? 'Activer les sons' : 'Couper les sons'}
      title={muted ? 'Activer les sons' : 'Couper les sons'}
      className="rounded-full p-2 text-muted hover:bg-slate-100 hover:text-navy"
    >
      {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
    </button>
  );
}
