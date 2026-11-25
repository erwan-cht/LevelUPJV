// Visualisation pas à pas d'une requête SELECT (piste W-01) : FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY.
//
// Principe : on découpe la requête en clauses, puis on exécute des requêtes intermédiaires sur la même base SQLite
// jetable que la correction automatique. Aucun moteur SQL n'est réécrit : SQLite fait le travail, on en montre les étapes.
// Les requêtes non gérées (UNION, WITH, sous-requête dans le FROM…) renvoient `supported: false` avec la raison.
import { DatabaseSync } from 'node:sqlite';
import { judge } from './sql.js';

export type StepKind = 'from' | 'join' | 'where' | 'group' | 'having' | 'select' | 'order';

export interface StepTable {
  name: string;
  alias: string;
  columns: string[];
  rows: string[][];
  total: number;
}

export interface StepGroup {
  key: string[];
  /** Indices (dans `rows` de l'étape) des lignes qui composent le groupe. */
  rows: number[];
  n: number;
  /** HAVING : le groupe est-il conservé ? */
  keep?: boolean;
}

export interface Step {
  kind: StepKind;
  title: string;
  /** Fragment de requête qui correspond à l'étape (ex. « WHERE ville = 'Amiens' »). */
  sql: string;
  /** Explication en français, avec les compteurs réels. */
  explain: string;
  tables?: StepTable[];
  columns?: string[];
  rows?: string[][];
  /** WHERE : pour chaque ligne, conservée ou éliminée. */
  keep?: boolean[];
  groupCols?: string[];
  groups?: StepGroup[];
  total?: number;
  truncated?: boolean;
}

export interface Explanation {
  supported: boolean;
  reason?: string;
  error?: string;
  steps: Step[];
}

export interface ExplainResult extends Explanation {
  passed?: boolean;
  message?: string;
  /** Index (dans `steps`) de la première étape où la requête s'écarte de la solution. */
  divergeAt?: number | null;
  divergeNote?: string;
  /** Même étape, vue côté solution (pour comparer côte à côte). */
  expectedStep?: Step;
}

const MAX_ROWS = 40;
const ORDER: StepKind[] = ['from', 'join', 'where', 'group', 'having', 'select', 'order'];

// ───────────── Découpage de la requête ─────────────

interface Parts {
  distinct: boolean;
  select: string;
  from: string;
  where?: string;
  group?: string;
  having?: string;
  order?: string;
  limit?: string;
}

type Clause = 'select' | 'from' | 'where' | 'group' | 'having' | 'order' | 'limit';
const CLAUSES: [Clause, RegExp][] = [
  ['select', /^select\b/i],
  ['from', /^from\b/i],
  ['where', /^where\b/i],
  ['group', /^group\s+by\b/i],
  ['having', /^having\b/i],
  ['order', /^order\s+by\b/i],
  ['limit', /^limit\b/i],
];

/** Parcourt la requête en ignorant les chaînes et les parenthèses : renvoie la position de chaque clause de premier niveau. */
function scan(q: string): { pos: [Clause, number, number][]; forbidden?: string } {
  const pos: [Clause, number, number][] = [];
  let depth = 0;
  let quote = '';
  for (let i = 0; i < q.length; i++) {
    const ch = q[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth !== 0 || (i > 0 && /[\w.]/.test(q[i - 1]))) continue;
    const rest = q.slice(i);
    if (/^(union|intersect|except)\b/i.test(rest)) return { pos, forbidden: 'les requêtes composées (UNION, INTERSECT, EXCEPT)' };
    for (const [name, re] of CLAUSES) {
      const m = re.exec(rest);
      if (m) {
        pos.push([name, i, i + m[0].length]);
        break;
      }
    }
  }
  return { pos };
}

function split(query: string): Parts | { unsupported: string } {
  const q = query.trim().replace(/;+\s*$/, '');
  if (/^with\b/i.test(q)) return { unsupported: 'les requêtes WITH (CTE)' };
  const { pos, forbidden } = scan(q);
  if (forbidden) return { unsupported: forbidden };
  if (!pos.length || pos[0][0] !== 'select' || !pos.some((p) => p[0] === 'from')) return { unsupported: 'les requêtes sans FROM' };

  const text: Partial<Record<Clause, string>> = {};
  pos.forEach(([name, , end], i) => {
    if (text[name] !== undefined) return; // une seule occurrence par clause
    text[name] = q.slice(end, i + 1 < pos.length ? pos[i + 1][1] : q.length).trim();
  });

  const distinct = /^distinct\b/i.test(text.select ?? '');
  return {
    distinct,
    select: (text.select ?? '').replace(/^distinct\b/i, '').trim(),
    from: text.from ?? '',
    where: text.where,
    group: text.group,
    having: text.having,
    order: text.order,
    limit: text.limit,
  };
}

/** Découpe une liste sur les virgules de premier niveau. */
function splitTop(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0) {
      const m = sep.exec(s.slice(i));
      if (m && m.index === 0 && m[0].length > 0 && !(i > 0 && /\w/.test(s[i - 1]) && /^\w/.test(m[0]))) {
        out.push(cur.trim());
        cur = '';
        i += m[0].length - 1;
        continue;
      }
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

interface TableRef {
  name: string;
  alias: string;
}

const NOT_ALIAS = /^(on|using|where|group|having|order|limit|join|left|right|inner|outer|cross|natural|full)$/i;
const unquote = (s: string) => s.replace(/^["`[]|["`\]]$/g, '');

function tablesOf(from: string): TableRef[] | null {
  const refs: TableRef[] = [];
  const parts = splitTop(from, /^(?:,|(?:(?:left|right|full|inner|cross|natural)\s+(?:outer\s+)?)?join\b)/i);
  for (const part of parts) {
    if (part.startsWith('(')) return null; // sous-requête dans le FROM
    const m = /^("[^"]+"|`[^`]+`|\w+)(?:\s+(?:as\s+)?("[^"]+"|`[^`]+`|\w+))?/i.exec(part);
    if (!m) return null;
    const name = unquote(m[1]);
    const alias = m[2] && !NOT_ALIAS.test(m[2]) ? unquote(m[2]) : name;
    refs.push({ name, alias });
  }
  return refs.length ? refs : null;
}

// ───────────── Exécution ─────────────

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
  return String(v);
};

const q1 = (s: string) => `"${s.replace(/"/g, '""')}"`;

class Runner {
  private db = new DatabaseSync(':memory:');
  constructor(setupSql: string) {
    this.db.exec(setupSql);
  }
  close() {
    this.db.close();
  }
  all(sql: string): { columns: string[]; rows: unknown[][] } {
    const stmt = this.db.prepare(sql);
    const columns = stmt.columns().map((c) => c.name);
    stmt.setReturnArrays(true);
    return { columns, rows: stmt.all() as unknown as unknown[][] };
  }
  columnsOf(table: string): string[] {
    return (this.db.prepare(`PRAGMA table_info(${q1(table)})`).all() as { name: string }[]).map((c) => c.name);
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const cut = <T>(rows: T[]) => rows.slice(0, MAX_ROWS);

/** Découpe et exécute les étapes d'une requête. Ne lève pas d'exception : l'erreur SQL est renvoyée dans `error`. */
export function explain(setupSql: string, query: string): Explanation {
  const parts = split(query);
  if ('unsupported' in parts) {
    return { supported: false, reason: `La visualisation ne gère pas encore ${parts.unsupported}.`, steps: [] };
  }
  const refs = tablesOf(parts.from);
  if (!refs) {
    return { supported: false, reason: 'La visualisation ne gère pas encore les sous-requêtes dans le FROM.', steps: [] };
  }

  const db = new Runner(setupSql);
  try {
    const steps: Step[] = [];
    const where = parts.where ? ` WHERE ${parts.where}` : '';
    const group = parts.group ? ` GROUP BY ${parts.group}` : '';
    const having = parts.having ? ` HAVING ${parts.having}` : '';

    // Colonnes préfixées par l'alias de la table : pas de collision entre deux colonnes « id ».
    const labelled = refs.flatMap((r) => db.columnsOf(r.name).map((c) => ({ sql: `${q1(r.alias)}.${q1(c)}`, label: `${r.alias}.${c}` })));
    const proj = labelled.map((c) => `${c.sql} AS ${q1(c.label)}`).join(', ');
    const labels = labelled.map((c) => c.label);

    // 1. FROM : les tables de départ
    const tables: StepTable[] = refs.map((r) => {
      const rows = db.all(`SELECT * FROM ${q1(r.name)}`);
      return { name: r.name, alias: r.alias, columns: rows.columns, rows: cut(rows.rows).map((x) => x.map(cell)), total: rows.rows.length };
    });
    steps.push({
      kind: 'from',
      title: 'FROM',
      sql: `FROM ${parts.from}`,
      explain: `On part de ${refs.length > 1 ? 'la table ' + refs[0].name + ' et des tables jointes' : 'la table ' + refs[0].name} : ${tables.map((t) => `${t.name} (${plural(t.total, 'ligne', 'lignes')})`).join(', ')}.`,
      tables,
    });

    // 2. JOIN : lignes combinées
    const joined = db.all(`SELECT ${proj} FROM ${parts.from}`);
    if (refs.length > 1) {
      steps.push({
        kind: 'join',
        title: 'JOIN',
        sql: `FROM ${parts.from}`,
        explain: `Les lignes des tables sont associées selon la condition de jointure : ${plural(joined.rows.length, 'ligne obtenue', 'lignes obtenues')}.`,
        columns: labels,
        rows: cut(joined.rows).map((x) => x.map(cell)),
        total: joined.rows.length,
        truncated: joined.rows.length > MAX_ROWS,
      });
    }

    // 3. WHERE : lignes conservées / éliminées
    let kept = joined.rows;
    if (parts.where) {
      const flagged = db.all(`SELECT ${proj}, CASE WHEN (${parts.where}) THEN 1 ELSE 0 END AS "__keep" FROM ${parts.from}`);
      const keep = flagged.rows.map((r) => r[r.length - 1] === 1);
      const rows = flagged.rows.map((r) => r.slice(0, -1));
      kept = rows.filter((_, i) => keep[i]);
      steps.push({
        kind: 'where',
        title: 'WHERE',
        sql: `WHERE ${parts.where}`,
        explain: `Chaque ligne est testée avec « ${parts.where} » : ${plural(kept.length, 'ligne conservée', 'lignes conservées')}, ${plural(rows.length - kept.length, 'éliminée', 'éliminées')}.`,
        columns: labels,
        rows: cut(rows).map((x) => x.map(cell)),
        keep: cut(keep),
        total: rows.length,
        truncated: rows.length > MAX_ROWS,
      });
    }

    // 4. GROUP BY : lignes rangées par groupe
    if (parts.group) {
      const exprs = splitTop(parts.group, /^,/);
      const keyed = db.all(`SELECT ${proj}, ${exprs.map((e, i) => `${e} AS "__g${i}"`).join(', ')} FROM ${parts.from}${where}`);
      const rows = keyed.rows.map((r) => r.slice(0, labels.length));
      const groups: StepGroup[] = [];
      const index = new Map<string, StepGroup>();
      keyed.rows.forEach((r, i) => {
        const key = r.slice(labels.length).map(cell);
        const id = JSON.stringify(key);
        let g = index.get(id);
        if (!g) {
          g = { key, rows: [], n: 0 };
          index.set(id, g);
          groups.push(g);
        }
        g.n++;
        if (i < MAX_ROWS) g.rows.push(i);
      });

      // 5. HAVING : groupes conservés / éliminés
      if (parts.having) {
        const flagged = db.all(
          `SELECT ${exprs.map((e, i) => `${e} AS "__g${i}"`).join(', ')}, CASE WHEN (${parts.having}) THEN 1 ELSE 0 END AS "__keep" FROM ${parts.from}${where}${group}`,
        );
        const verdict = new Map(flagged.rows.map((r) => [JSON.stringify(r.slice(0, -1).map(cell)), r[r.length - 1] === 1]));
        for (const g of groups) g.keep = verdict.get(JSON.stringify(g.key)) ?? true;
      }

      steps.push({
        kind: 'group',
        title: 'GROUP BY',
        sql: `GROUP BY ${parts.group}`,
        explain: `Les lignes sont rangées par ${exprs.join(', ')} : ${plural(groups.length, 'groupe', 'groupes')}.`,
        columns: labels,
        rows: cut(rows).map((x) => x.map(cell)),
        groupCols: exprs,
        groups,
        total: rows.length,
        truncated: rows.length > MAX_ROWS,
      });
      if (parts.having) {
        const ok = groups.filter((g) => g.keep).length;
        steps.push({
          kind: 'having',
          title: 'HAVING',
          sql: `HAVING ${parts.having}`,
          explain: `Chaque groupe est testé avec « ${parts.having} » : ${plural(ok, 'groupe conservé', 'groupes conservés')}, ${plural(groups.length - ok, 'éliminé', 'éliminés')}.`,
          columns: labels,
          rows: cut(rows).map((x) => x.map(cell)),
          groupCols: exprs,
          groups,
          total: groups.length,
        });
      }
    }

    // 6. SELECT : colonnes calculées
    const selected = db.all(`SELECT${parts.distinct ? ' DISTINCT' : ''} ${parts.select} FROM ${parts.from}${where}${group}${having}`);
    const aggregates = !parts.group && /\b(count|sum|avg|min|max|total|group_concat)\s*\(/i.test(parts.select);
    steps.push({
      kind: 'select',
      title: 'SELECT',
      sql: `SELECT${parts.distinct ? ' DISTINCT' : ''} ${parts.select}`,
      explain: aggregates
        ? `Les lignes restantes sont résumées en ${plural(selected.rows.length, 'valeur', 'valeurs')} : ${parts.select}.`
        : parts.group
          ? `Pour chaque groupe conservé, on calcule : ${parts.select}.`
          : `On ne garde que les colonnes demandées : ${parts.select}${parts.distinct ? ', sans doublons' : ''}.`,
      columns: selected.columns,
      rows: cut(selected.rows).map((x) => x.map(cell)),
      total: selected.rows.length,
      truncated: selected.rows.length > MAX_ROWS,
    });

    // 7. ORDER BY / LIMIT : résultat final
    if (parts.order || parts.limit) {
      const full = db.all(query.trim().replace(/;+\s*$/, ''));
      const clause = [parts.order && `ORDER BY ${parts.order}`, parts.limit && `LIMIT ${parts.limit}`].filter(Boolean).join(' ');
      steps.push({
        kind: 'order',
        title: parts.order ? 'ORDER BY' : 'LIMIT',
        sql: clause,
        explain: `${parts.order ? `Tri par ${parts.order}.` : ''}${parts.limit ? ` On garde ${parts.limit} ligne(s) au plus.` : ''}`.trim(),
        columns: full.columns,
        rows: cut(full.rows).map((x) => x.map(cell)),
        total: full.rows.length,
        truncated: full.rows.length > MAX_ROWS,
      });
    }

    return { supported: true, steps };
  } catch (e) {
    return { supported: true, error: e instanceof Error ? e.message : 'Erreur SQL', steps: [] };
  } finally {
    db.close();
  }
}

// ───────────── Comparaison avec la solution ─────────────

/** Empreinte d'une étape, insensible à l'ordre des colonnes et des lignes (sauf pour le tri final). */
function signature(s: Step): string {
  const rowSig = (r: string[]) => JSON.stringify([...r].sort());
  switch (s.kind) {
    case 'from':
      return JSON.stringify((s.tables ?? []).map((t) => t.name.toLowerCase()).sort());
    case 'join':
    case 'select':
      return JSON.stringify((s.rows ?? []).map(rowSig).sort());
    case 'where':
      return JSON.stringify((s.rows ?? []).filter((_, i) => s.keep?.[i]).map(rowSig).sort());
    case 'group':
      return JSON.stringify((s.groups ?? []).map((g) => `${JSON.stringify(g.key)}#${g.n}`).sort());
    case 'having':
      return JSON.stringify((s.groups ?? []).filter((g) => g.keep).map((g) => `${JSON.stringify(g.key)}#${g.n}`).sort());
    case 'order':
      return JSON.stringify((s.rows ?? []).map((r) => JSON.stringify(r)));
  }
}

const DIVERGENCE: Record<StepKind, string> = {
  from: 'Les tables de départ ne sont pas celles attendues.',
  join: 'La jointure ne produit pas les mêmes lignes que celle attendue.',
  where: 'Le WHERE ne garde pas les mêmes lignes que celui attendu.',
  group: 'Les groupes formés ne sont pas ceux attendus.',
  having: 'Le HAVING ne garde pas les mêmes groupes que celui attendu.',
  select: 'Les valeurs calculées par le SELECT ne sont pas celles attendues.',
  order: 'Le tri (ou la limite) ne donne pas l’ordre attendu.',
};
const MISSING: Record<StepKind, string> = {
  from: 'Il manque une table.',
  join: 'Il manque une jointure.',
  where: 'Il manque un filtre WHERE.',
  group: 'Il manque un GROUP BY.',
  having: 'Il manque un HAVING.',
  select: 'Il manque le SELECT.',
  order: 'Il manque un ORDER BY ou un LIMIT.',
};
const EXTRA: Record<StepKind, string> = {
  from: 'Une table en trop.',
  join: 'Une jointure en trop.',
  where: 'Ce WHERE n’est pas attendu ici.',
  group: 'Ce GROUP BY n’est pas attendu ici.',
  having: 'Ce HAVING n’est pas attendu ici.',
  select: 'Ce SELECT n’est pas attendu ici.',
  order: 'Ce tri (ou cette limite) n’est pas attendu ici.',
};

/**
 * Explique la requête de l'étudiant et, si son résultat est faux, repère la première étape
 * où elle s'écarte de la requête de référence.
 */
export function explainAttempt(setupSql: string, solutionSql: string | null, answer: string): ExplainResult {
  const mine = explain(setupSql, answer);
  if (!mine.supported || mine.error) return mine;

  const verdict = solutionSql ? judge(setupSql, solutionSql, answer) : null;
  if (!verdict || 'error' in verdict) return { ...mine, passed: undefined, divergeAt: null };
  const out: ExplainResult = { ...mine, passed: verdict.passed, message: verdict.message, divergeAt: null };
  if (verdict.passed || !solutionSql) return out;

  const ref = explain(setupSql, solutionSql);
  if (!ref.supported || ref.error) return out;

  for (const kind of ORDER) {
    const a = mine.steps.find((s) => s.kind === kind);
    const b = ref.steps.find((s) => s.kind === kind);
    if (!a && !b) continue;
    if (a && b && signature(a) === signature(b)) continue;

    if (a && b) {
      out.divergeAt = mine.steps.indexOf(a);
      out.divergeNote = DIVERGENCE[kind];
      out.expectedStep = b;
    } else if (a) {
      out.divergeAt = mine.steps.indexOf(a);
      out.divergeNote = EXTRA[kind];
    } else {
      // Étape absente chez l'étudiant : on pointe la première étape suivante qu'il a écrite.
      const later = mine.steps.find((s) => ORDER.indexOf(s.kind) > ORDER.indexOf(kind));
      const at = later ?? mine.steps[mine.steps.length - 1];
      out.divergeAt = mine.steps.indexOf(at);
      out.divergeNote = MISSING[kind];
      // On compare à la même étape côté solution (ex. le SELECT filtré par le HAVING manquant).
      out.expectedStep = ref.steps.find((s) => s.kind === at.kind) ?? b;
    }
    return out;
  }
  // Toutes les étapes coïncident mais le résultat diffère (ex. colonnes en trop).
  out.divergeAt = mine.steps.length - 1;
  out.divergeNote = 'Les étapes sont identiques, mais le résultat final ne correspond pas (colonnes ou ordre).';
  return out;
}
