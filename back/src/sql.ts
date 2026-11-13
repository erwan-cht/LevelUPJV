// Correction automatique des défis SQL : chaque exécution a sa propre base SQLite jetable en mémoire.
import { DatabaseSync } from 'node:sqlite';

export interface Table {
  columns: string[];
  rows: string[][];
}

export interface RunResult extends Table {
  error?: string;
}

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
  return String(v);
};

/** N'autorise qu'une seule requête de lecture (SELECT ou WITH). */
function checkReadOnly(query: string): string | null {
  const q = query.trim().replace(/;+\s*$/, '');
  if (!q) return 'La requête est vide.';
  if (q.includes(';')) return 'Une seule requête à la fois.';
  if (!/^(select|with)\b/i.test(q)) return 'Seules les requêtes SELECT sont autorisées.';
  return null;
}

export function runQuery(setupSql: string, query: string): RunResult {
  const refused = checkReadOnly(query);
  if (refused) return { columns: [], rows: [], error: refused };

  const db = new DatabaseSync(':memory:');
  try {
    db.exec(setupSql);
    const stmt = db.prepare(query.trim().replace(/;+\s*$/, ''));
    const columns = stmt.columns().map((c) => c.name);
    const rows = (stmt.all() as Record<string, unknown>[]).slice(0, 200).map((r) => columns.map((c) => cell(r[c])));
    return { columns, rows };
  } catch (e) {
    return { columns: [], rows: [], error: e instanceof Error ? e.message : 'Erreur SQL' };
  } finally {
    db.close();
  }
}

/** Tables du jeu de données (nom, colonnes, lignes) pour les afficher à l'étudiant. */
export function describeTables(setupSql: string): (Table & { name: string })[] {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(setupSql);
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY rowid").all() as { name: string }[]).map(
      (t) => t.name,
    );
    return names.map((name) => {
      const stmt = db.prepare(`SELECT * FROM "${name}" LIMIT 20`);
      const columns = stmt.columns().map((c) => c.name);
      const rows = (stmt.all() as Record<string, unknown>[]).map((r) => columns.map((c) => cell(r[c])));
      return { name, columns, rows };
    });
  } finally {
    db.close();
  }
}

export interface Verdict {
  passed: boolean;
  testsPassed: number;
  testsTotal: number;
  expected: Table;
  obtained: Table;
  message: string;
}

/** Compare le résultat de l'étudiant à celui de la requête de référence (valeurs, pas noms de colonnes). */
export function judge(setupSql: string, solutionSql: string, answer: string): Verdict | { error: string } {
  const expected = runQuery(setupSql, solutionSql);
  const obtained = runQuery(setupSql, answer);
  if (obtained.error) return { error: obtained.error };

  const ordered = /order\s+by/i.test(solutionSql);
  const key = (r: string[]) => JSON.stringify(r);
  const want = expected.rows.map(key);
  const got = obtained.rows.map(key);
  const same =
    expected.columns.length === obtained.columns.length &&
    (ordered ? want.join('|') === got.join('|') : [...want].sort().join('|') === [...got].sort().join('|'));

  const pool = [...want];
  const found = got.filter((g) => {
    const i = pool.indexOf(g);
    if (i === -1) return false;
    pool.splice(i, 1);
    return true;
  }).length;

  let message = 'Bravo ! Résultat identique à celui attendu.';
  if (!same) {
    if (expected.columns.length !== obtained.columns.length) {
      message = `Il faut ${expected.columns.length} colonne(s), ta requête en renvoie ${obtained.columns.length}.`;
    } else if (obtained.rows.length < expected.rows.length) {
      message = `Résultat différent : il manque ${expected.rows.length - obtained.rows.length} ligne(s) (${obtained.rows.length} obtenue(s), ${expected.rows.length} attendue(s)).`;
    } else if (obtained.rows.length > expected.rows.length) {
      message = `Résultat différent : ${obtained.rows.length - expected.rows.length} ligne(s) en trop (${obtained.rows.length} obtenue(s), ${expected.rows.length} attendue(s)).`;
    } else {
      message = 'Résultat différent : les valeurs (ou leur ordre) ne correspondent pas.';
    }
  }

  return {
    passed: same,
    testsPassed: same ? Math.max(expected.rows.length, 1) : Math.min(found, Math.max(expected.rows.length - 1, 0)),
    testsTotal: Math.max(expected.rows.length, 1),
    expected,
    obtained,
    message,
  };
}
