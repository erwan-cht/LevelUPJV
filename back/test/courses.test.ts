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
fs.writeFileSync(path.join(dir, 'sans-pdf.json'), JSON.stringify({ id: 'sans-pdf', title: 'x', author: 'y', pages: ['a'] }));
fs.writeFileSync(path.join(dir, 'casse.json'), '{pas du json');
process.env.COURSES_DIR = dir;

const { courses, getCourse, courseContext, outline, sanitizeCitations } = await import('../src/courses.js');

test('charge uniquement les cours complets (json valide + pdf)', () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    assert.deepEqual([...courses().keys()], ['demo']);
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
