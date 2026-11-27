import { useEffect, useRef, useState } from 'react';
import { UNAUTHORIZED_EVENT, getToken } from './api';

/**
 * Abonnement à un flux Server-Sent Events de l'API. EventSource ne sait pas envoyer l'en-tête Authorization :
 * on lit donc le flux avec fetch. Reconnexion automatique (coupure réseau, redémarrage du serveur).
 */
export function useStream<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    if (!path) return;
    const ctrl = new AbortController();
    let retry: number | undefined;
    let delay = 1000;

    const open = async () => {
      try {
        const token = getToken();
        const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: ctrl.signal });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
          setError((body as { error?: string }).error ?? 'Flux indisponible.');
          if (res.status === 403 || res.status === 404) return; // inutile d'insister
          throw new Error('retry');
        }
        setConnected(true);
        setError(null);
        delay = 1000;
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let cut: number;
          while ((cut = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const payload = chunk
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trimStart())
              .join('\n');
            if (payload) setData(JSON.parse(payload) as T);
          }
        }
        throw new Error('closed');
      } catch {
        if (ctrl.signal.aborted) return;
        setConnected(false);
        retry = window.setTimeout(open, delay);
        delay = Math.min(delay * 2, 8000);
      }
    };
    void open();
    return () => {
      ctrl.abort();
      window.clearTimeout(retry);
      setConnected(false);
    };
  }, [path]);

  return { data, error, connected };
}

/** Écart entre l'horloge du serveur et celle du navigateur, pour un compte à rebours juste. */
export function useCountdown(endsAt: number | null | undefined, serverNow: number | undefined) {
  const [, tick] = useState(0);
  const offset = useRef(0);
  useEffect(() => {
    if (serverNow) offset.current = serverNow - Date.now();
  }, [serverNow]);
  useEffect(() => {
    if (!endsAt) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.floor((endsAt - (Date.now() + offset.current)) / 1000));
}

const pad = (n: number) => String(n).padStart(2, '0');
export const formatClock = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(sec % 60)}` : `${pad(m)}:${pad(sec % 60)}`;
};
