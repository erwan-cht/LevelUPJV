import { useEffect, useRef, useState } from 'react';
import { getToken } from '../api';

// ───────────── Types : reflet de back/src/arena.ts ─────────────

export interface Table {
  name: string;
  columns: string[];
  rows: string[][];
}

export interface ArenaChallenge {
  id: number;
  title: string;
  statement: string;
  difficulty: string;
  starterCode: string;
  tables: Table[];
}

export interface BoardRow {
  pseudo: string;
  points: number;
  solved: number;
  rank: number;
}

export interface Analysis {
  participants: number;
  answered: number;
  solved: number;
  successPct: number;
  avgSolveSec: number | null;
  byStep: { step: string; count: number; pct: number }[];
  stuck: number;
}

interface Common {
  code: string;
  phase: 'lobby' | 'question' | 'reveal' | 'finished';
  index: number;
  total: number;
  joined: number;
  serverNow: number;
  endsAt: number | null;
  timeLimitSec: number;
  challenge?: ArenaChallenge;
  leaderboard: BoardRow[];
  full?: BoardRow[];
}

export interface HostView extends Common {
  role: 'host';
  people: string[];
  titles: string[];
  answered: number;
  solvedCount: number;
  analysis?: Analysis;
  analyses?: { id: number; title: string; analysis: Analysis }[];
  solution?: string | null;
  /** Pages du cours à revoir pour l'étape où la salle a le plus buté. */
  review?: { course: { id: string; title: string; author: string; total: number }; pages: number[] };
}

export interface PlayerView extends Common {
  role: 'player';
  me?: { rank: number; points: number; solved: number; outOf: number };
  current?: { solved: boolean; attempts: number; points: number };
}

export type ArenaView = HostView | PlayerView;

// ───────────── Flux en direct ─────────────

/**
 * Suit une séance en direct (Server-Sent Events). On passe par `fetch` plutôt que `EventSource` : il permet d'envoyer le jeton.
 * Si la connexion tombe (réseau du lycée, redémarrage du serveur…), elle se rétablit seule et l'écran se remet à jour.
 */
export function useArenaStream(code: string | null) {
  const [view, setView] = useState<ArenaView | null>(null);
  const [status, setStatus] = useState<'connecting' | 'open' | 'error'>('connecting');
  const [error, setError] = useState('');
  const skew = useRef(0); // écart entre l'horloge du serveur et celle de cet appareil

  useEffect(() => {
    if (!code) return;
    let stop = false;
    let controller: AbortController | null = null;
    let retry = 0;

    const run = async () => {
      while (!stop) {
        controller = new AbortController();
        try {
          const res = await fetch(`/api/arena/${code}/stream`, { headers: { Authorization: `Bearer ${getToken() ?? ''}` }, signal: controller.signal });
          if (!res.ok || !res.body) {
            if (res.status === 403 || res.status === 404 || res.status === 401) {
              const body = (await res.json().catch(() => ({}))) as { error?: string };
              setError(body.error ?? 'Salle introuvable.');
              setStatus('error');
              return; // inutile de réessayer
            }
            throw new Error(`http ${res.status}`);
          }
          setStatus('open');
          setError('');
          retry = 0;

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let cut: number;
            while ((cut = buffer.indexOf('\n\n')) >= 0) {
              const block = buffer.slice(0, cut);
              buffer = buffer.slice(cut + 2);
              const line = block.split('\n').find((l) => l.startsWith('data: '));
              if (!line) continue; // commentaire de maintien de la connexion
              const next = JSON.parse(line.slice(6)) as ArenaView;
              skew.current = next.serverNow - Date.now();
              setView(next);
            }
          }
        } catch {
          if (stop) return;
        }
        setStatus('connecting');
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** retry++, 5000)));
      }
    };
    void run();
    return () => {
      stop = true;
      controller?.abort();
    };
  }, [code]);

  return { view, status, error, skew };
}

/** Secondes restantes avant `endsAt` (heure du serveur), mises à jour quatre fois par seconde. */
export function useCountdown(endsAt: number | null | undefined, skew: { current: number }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(Math.max(0, (endsAt - (Date.now() + skew.current)) / 1000));
    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [endsAt, skew]);
  return left;
}

/** 125 → « 2:05 » (arrondi à la seconde supérieure : l'affichage ne passe à 0:00 qu'à la fin). */
export const mmss = (seconds: number) => {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
