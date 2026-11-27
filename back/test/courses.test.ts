import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Un faux cours dans un dossier temporaire : les vrais cours ne sont pas dans le dépôt.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cours-'));
fs.writeFileSync(
  path.join(dir, 'demo.json'),
  JSON.stringify({ id: 'demo', title: 'Cours de démo', author: 'A. Dupont', pages: ['1. Intro\nBonjour', '2. SELECT\nSELECT * FROM t', '2. SELECT\nsuite', '', '3. WHERE\nWHERE x = 1'] }),
);
fs.writeFileSync(path.join(dir, 'demo.pdf'), '%PDF-1.4');
fs.writeFileSync(
  path.join(dir, 'sql.json'),
  JSON.stringify({
    id: 'sql',
    title: 'SQL',
    author: 'B. Test',
    pages: [
      '1. La commande SELECT -Projection\nSELECT a FROM t',
      '1. La commande SELECT -Projection\nsuite',
      '2. La commande WHERE -Sélection\nWHERE a = 1',
      '5. La commande WHERE –Jointure\nSELECT * FROM R1, R2 WHERE R1.a = R2.a',
      '5. La commande WHERE –Jointure\nsuite',
      '6. La commande WHERE –Produit cartésien\nSELECT * FROM R1, R2',
      '8. La commande GROUP BY –Regroupement\nGROUP BY x\nHAVING AVG(y) > 10',
      '3. La commande ORDER BY –Tri\nORDER BY a',
    ],
  }),
);
fs.writeFileSync(path.join(dir, 'sql.pdf'), '%PDF-1.4');
fs.writeFileSync(path.join(dir, 'sans-pdf.json'), JSON.stringify({ id: 'sans-pdf', title: 'x', author: 'y', pages: ['a'] }));
fs.writeFileSync(path.join(dir, 'casse.json'), '{pas du json');
process.env.COURSES_DIR = dir;

const { courses, getCourse, courseContext, outline, sanitizeCitations } = await import('../src/courses.js');

test('charge uniquement les cours complets (json valide + pdf)', () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    assert.deepEqual([...courses().keys()].sort(), ['demo', 'sql']);
  } finally {
    console.error = quiet;
  }
  assert.equal(getCourse('demo')?.title, 'Cours de démo');
  assert.equal(getCourse('../etc/passwd'), null);
  assert.equal(getCourse(undefined), null);
});

test('le contexte marque chaque page', () => {
  const ctx = courseContext(getCourse('demo')!);
  assert.match(ctx, /^\[p\. 1\]\n1\. Intro/);
  assert.ok(ctx.includes('[p. 5]\n3. WHERE'));
});

test('le plan regroupe les pages au même titre et saute les pages vides', () => {
  assert.deepEqual(outline(getCourse('demo')!), [
    { page: 1, title: '1. Intro' },
    { page: 2, title: '2. SELECT' },
    { page: 5, title: '3. WHERE' },
  ]);
});

test('les citations de pages inexistantes sont retirées', () => {
  const c = getCourse('demo')!; // 5 pages
  assert.equal(sanitizeCitations('Voir le WHERE [p. 5] et [p. 2-3].', c), 'Voir le WHERE [p. 5] et [p. 2-3].');
  assert.equal(sanitizeCitations('Inventé [p. 99] et [p. 0] et [p. 3-9] fin.', c), 'Inventé et et fin.');
});

test('pages du cours pour chaque étape d’une requête', async () => {
  const { pagesForStep } = await import('../src/courses.js');
  const c = getCourse('sql')!;
  assert.deepEqual(pagesForStep(c, 'from'), [1, 2]);
  assert.deepEqual(pagesForStep(c, 'where'), [3]);
  assert.deepEqual(pagesForStep(c, 'join'), [4, 5]);
  assert.deepEqual(pagesForStep(c, 'cartesian'), [6]);
  assert.deepEqual(pagesForStep(c, 'group'), [7]);
  assert.deepEqual(pagesForStep(c, 'having'), [7]); // pas de titre propre : trouvé dans le texte
  assert.deepEqual(pagesForStep(c, 'order'), [8]);
  assert.deepEqual(pagesForStep(getCourse('demo')!, 'where'), []); // le cours n'en parle pas
});
