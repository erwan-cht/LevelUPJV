// Supports de cours : le texte de chaque page sert de source à l'assistant, qui cite les pages (« [p. 74] »).
//
// Les cours ne sont PAS dans le dépôt : ils appartiennent à leurs auteurs. Ils vivent dans un dossier (COURSES_DIR,
// par défaut ../data/cours) et se préparent avec `npx tsx scripts/ingest-course.ts` (un <id>.pdf et un <id>.json par cours).
import fs from 'node:fs';
import path from 'node:path';

export interface Course {
  id: string;
  title: string;
  author: string;
  /** Texte de chaque page ; la page n° N est `pages[N - 1]`. */
  pages: string[];
}

export interface OutlineEntry {
  page: number;
  title: string;
}

const dir = () => path.resolve(process.env.COURSES_DIR ?? '../data/cours');

let cache: { at: number; dir: string; byId: Map<string, Course> } | null = null;

/** Cours disponibles (relus au plus toutes les 60 s : on peut en ajouter sans redémarrer). */
export function courses(): Map<string, Course> {
  const d = dir();
  if (cache && cache.dir === d && Date.now() - cache.at < 60_000) return cache.byId;
  const byId = new Map<string, Course>();
  try {
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.json')) continue;
      const id = f.slice(0, -5);
      if (!/^[a-z0-9-]+$/.test(id) || !fs.existsSync(path.join(d, `${id}.pdf`))) continue;
      try {
        const c = JSON.parse(fs.readFileSync(path.join(d, f), 'utf-8')) as Course;
        if (Array.isArray(c.pages) && c.pages.length) byId.set(id, { id, title: String(c.title), author: String(c.author), pages: c.pages.map(String) });
      } catch {
        console.error(`Cours illisible : ${f}`);
      }
    }
  } catch {
    /* dossier absent : aucun cours, l'assistant répond avec des connaissances générales */
  }
  cache = { at: Date.now(), dir: d, byId };
  return byId;
}

export const getCourse = (id: unknown): Course | null => (typeof id === 'string' ? (courses().get(id) ?? null) : null);

export const coursePdfPath = (c: Course): string => path.join(dir(), `${c.id}.pdf`);

/** Le cours tout entier, page par page : il est assez court pour tenir dans le contexte du modèle (pas de recherche à faire). */
export function courseContext(c: Course): string {
  return c.pages.map((t, i) => `[p. ${i + 1}]\n${t}`).join('\n\n');
}

/** Plan : le titre de chaque diapositive (première ligne), les pages consécutives au même titre étant regroupées. */
export function outline(c: Course): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  c.pages.forEach((t, i) => {
    const title = t.split('\n')[0]?.trim().slice(0, 90);
    if (!title || title === out[out.length - 1]?.title) return;
    out.push({ page: i + 1, title });
  });
  return out;
}

/** Retire les citations de pages qui n'existent pas : le modèle ne doit pas pouvoir « inventer » une source. */
export function sanitizeCitations(text: string, c: Course): string {
  return text.replace(/\s?\[p\.\s*(\d+)(?:\s*[-–]\s*(\d+))?\]/g, (m, a: string, b?: string) => {
    const from = Number(a);
    const to = b ? Number(b) : from;
    return from >= 1 && to >= from && to <= c.pages.length ? m : '';
  });
}

export const defaultCourse = (): Course | null => courses().values().next().value ?? null;

/** Étape d'une requête, ou « cartesian » pour la jointure écrite à la virgule (FROM R1, R2 WHERE …). */
export type StepKey = 'from' | 'join' | 'cartesian' | 'where' | 'group' | 'having' | 'select' | 'order';

/** Titres de diapositives (première ligne) qui traitent chaque étape. Le HAVING n'a pas de titre propre : on cherche dans le texte. */
const STEP_TITLE: Record<Exclude<StepKey, 'having'>, RegExp> = {
  from: /commande SELECT/i,
  join: /WHERE\s*[–-]\s*Jointure/i,
  cartesian: /Produit cart[ée]sien/i,
  where: /commande WHERE\s*[–-]\s*S[ée]lection/i,
  group: /GROUP BY/i,
  select: /SELECT\s*[–-]\s*Projection/i,
  order: /ORDER BY/i,
};

/** Pages du cours qui expliquent une étape (au plus 3, de la première page trouvée et du même titre) ; vide si le cours n'en parle pas. */
export function pagesForStep(c: Course, key: StepKey): number[] {
  const titleOf = (i: number) => c.pages[i]?.split('\n')[0]?.trim() ?? '';
  const first = c.pages.findIndex((t, i) => (key === 'having' ? /\bhaving\b/i.test(t) : STEP_TITLE[key].test(titleOf(i))));
  if (first === -1) return [];
  const out = [first + 1];
  for (let i = first + 1; i < c.pages.length && out.length < 3 && titleOf(i) === titleOf(first); i++) out.push(i + 1);
  return out;
}
