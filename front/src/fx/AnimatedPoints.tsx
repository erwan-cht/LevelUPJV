import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../components/ui';

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

/** Points qui défilent jusqu'à leur nouvelle valeur, avec un « +N » qui s'envole quand on en gagne. */
export default function AnimatedPoints({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [gain, setGain] = useState<number | null>(null);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    if (value === from) return;
    previous.current = value;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm) {
      setShown(value);
      return;
    }
    let clear: number | undefined;
    if (value > from) {
      setGain(value - from);
      clear = window.setTimeout(() => setGain(null), 1800);
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 800);
      setShown(Math.round(from + (value - from) * easeOut(k)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(clear);
    };
  }, [value]);

  return (
    <span className="relative inline-block tabular-nums">
      {formatNumber(shown)} pts
      {gain !== null && <span className="fx-float-up pointer-events-none absolute -top-2 right-0 text-xs font-bold text-green-600">+{formatNumber(gain)}</span>}
    </span>
  );
}
