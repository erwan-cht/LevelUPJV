export type Pose = 'hello' | 'cheer' | 'think' | 'encourage' | 'trophy';

/** La mascotte de la plateforme (une chouette diplômée) : images dans public/mascot/. */
export default function Mascot({ pose, className = 'h-24 w-24', alt = '' }: { pose: Pose; className?: string; alt?: string }) {
  return <img src={`/mascot/${pose}.webp`} alt={alt} className={`${className} select-none object-contain`} draggable={false} />;
}
