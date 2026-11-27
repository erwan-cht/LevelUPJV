// Confettis : un canevas plein écran, quelques centaines de particules, retiré dès que c'est fini. Aucune dépendance.
// Désactivé si l'utilisateur a demandé de réduire les animations.

const COLORS = ['#ef8a0e', '#26314f', '#0094CC', '#22c55e', '#facc15', '#ec4899', '#8b5cf6'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  shape: 0 | 1;
}

/** Lance des confettis. `origin` : point de départ en proportion de l'écran (0 à 1), par défaut le haut au centre. */
export function confetti({ count = 150, origin = { x: 0.5, y: 0.25 }, spread = 1 }: { count?: number; origin?: { x: number; y: number }; spread?: number } = {}) {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const g = canvas.getContext('2d');
  if (!g) {
    canvas.remove();
    return;
  }
  g.scale(dpr, dpr);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const pieces: Piece[] = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * spread;
    const speed = 6 + Math.random() * 9;
    return {
      x: origin.x * W,
      y: origin.y * H,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: Math.random() < 0.5 ? 0 : 1,
    };
  });

  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    g.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of pieces) {
      p.vy += 0.28; // pesanteur
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > H + 20) continue;
      alive++;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.globalAlpha = Math.max(0, 1 - t / 3600);
      g.fillStyle = p.color;
      if (p.shape === 0) g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else {
        g.beginPath();
        g.arc(0, 0, p.size / 3, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    if (alive > 0 && t < 3600) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** Salve plus généreuse : deux canons latéraux puis une pluie centrale. */
export function bigConfetti() {
  confetti({ count: 110, origin: { x: 0.1, y: 0.7 }, spread: 0.6 });
  confetti({ count: 110, origin: { x: 0.9, y: 0.7 }, spread: 0.6 });
  window.setTimeout(() => confetti({ count: 140, origin: { x: 0.5, y: 0.2 }, spread: 1.2 }), 250);
}
