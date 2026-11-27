import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, explainAttempt } from '../src/sqlsteps.js';

const SHOP = `
CREATE TABLE clients (id INTEGER PRIMARY KEY, nom TEXT, ville TEXT);
CREATE TABLE commandes (id INTEGER PRIMARY KEY, client_id INTEGER, montant REAL, date_commande TEXT);
INSERT INTO clients VALUES (1,'Alice','Amiens'),(2,'Bob','Paris'),(3,'Chloé','Amiens'),(4,'David','Lille');
INSERT INTO commandes VALUES (1,1,45.0,'2026-01-10'),(2,1,20.0,'2026-02-02'),(3,2,99.9,'2026-02-14'),(4,3,12.5,'2026-03-01');
`;

const kinds = (sql: string) => explain(SHOP, sql).steps.map((s) => s.kind);

test('requête simple : FROM, WHERE, SELECT, ORDER', () => {
  const r = explain(SHOP, "SELECT nom FROM clients WHERE ville = 'Amiens' ORDER BY nom;");
  assert.equal(r.supported, true);
  assert.deepEqual(r.steps.map((s) => s.kind), ['from', 'where', 'select', 'order']);
  const where = r.steps[1];
  assert.equal(where.total, 4);
  assert.deepEqual(where.keep, [true, false, true, false]);
  assert.deepEqual(r.steps[2].rows, [['Alice'], ['Chloé']]);
});

test('jointure + GROUP BY + HAVING + ORDER', () => {
  const r = explain(
    SHOP,
    'SELECT c.ville, SUM(o.montant) AS total FROM clients c JOIN commandes o ON o.client_id = c.id GROUP BY c.ville HAVING SUM(o.montant) > 80 ORDER BY total DESC;',
  );
  assert.deepEqual(r.steps.map((s) => s.kind), ['from', 'join', 'group', 'having', 'select', 'order']);
  const join = r.steps[1];
  assert.equal(join.total, 4);
  assert.ok(join.columns?.includes('c.id') && join.columns?.includes('o.id'), 'colonnes préfixées par l’alias');
  const having = r.steps[3];
  const byKey = Object.fromEntries((having.groups ?? []).map((g) => [g.key[0], g.keep]));
  assert.deepEqual(byKey, { Amiens: false, Paris: true }); // Amiens = 77,5 (éliminé), Paris = 99,9
});

test('agrégat sans GROUP BY', () => {
  const r = explain(SHOP, "SELECT COUNT(*) FROM clients WHERE ville = 'Amiens'");
  assert.deepEqual(r.steps.map((s) => s.kind), ['from', 'where', 'select']);
  assert.deepEqual(r.steps[2].rows, [['2']]);
});

test('LEFT JOIN conserve les clients sans commande', () => {
  const r = explain(SHOP, 'SELECT c.nom, COUNT(o.id) AS nb FROM clients c LEFT JOIN commandes o ON o.client_id = c.id GROUP BY c.id, c.nom ORDER BY c.nom');
  assert.equal(r.steps.find((s) => s.kind === 'join')?.total, 5); // Alice x2, Bob, Chloé, David (NULL)
  assert.equal(r.steps.find((s) => s.kind === 'group')?.groups?.length, 4);
});

test('sous-requête dans le WHERE : gérée', () => {
  assert.deepEqual(kinds('SELECT nom FROM clients WHERE id IN (SELECT client_id FROM commandes WHERE montant > 50) ORDER BY nom'), ['from', 'where', 'select', 'order']);
});

test('requêtes non gérées : message clair', () => {
  assert.equal(explain(SHOP, 'SELECT nom FROM clients UNION SELECT nom FROM clients').supported, false);
  assert.equal(explain(SHOP, 'WITH x AS (SELECT 1) SELECT * FROM x').supported, false);
  assert.equal(explain(SHOP, 'SELECT * FROM (SELECT 1 AS a) t').supported, false);
});

test('erreur SQL renvoyée sans exception', () => {
  const r = explain(SHOP, 'SELECT nom FROM inconnue');
  assert.ok(r.error);
});

test('divergence : WHERE manquant', () => {
  const sol = "SELECT nom FROM clients WHERE ville = 'Amiens' ORDER BY nom";
  const r = explainAttempt(SHOP, sol, 'SELECT nom FROM clients ORDER BY nom');
  assert.equal(r.passed, false);
  assert.match(r.divergeNote ?? '', /WHERE/);
  assert.equal(r.steps[r.divergeAt ?? -1].kind, 'select');
});

test('divergence : mauvais filtre', () => {
  const sol = "SELECT nom FROM clients WHERE ville = 'Amiens' ORDER BY nom";
  const r = explainAttempt(SHOP, sol, "SELECT nom FROM clients WHERE ville = 'Paris' ORDER BY nom");
  assert.equal(r.steps[r.divergeAt ?? -1].kind, 'where');
  assert.ok(r.expectedStep);
});

test('divergence : INNER JOIN au lieu de LEFT JOIN', () => {
  const sol = 'SELECT c.nom, COUNT(o.id) AS nb FROM clients c LEFT JOIN commandes o ON o.client_id = c.id GROUP BY c.id, c.nom ORDER BY c.nom';
  const r = explainAttempt(SHOP, sol, 'SELECT c.nom, COUNT(o.id) AS nb FROM clients c JOIN commandes o ON o.client_id = c.id GROUP BY c.id, c.nom ORDER BY c.nom');
  assert.equal(r.steps[r.divergeAt ?? -1].kind, 'join');
});

test('bonne réponse : pas de divergence', () => {
  const sol = 'SELECT ville, COUNT(*) AS nb FROM clients GROUP BY ville';
  const r = explainAttempt(SHOP, sol, 'SELECT ville, COUNT(*) AS n FROM clients GROUP BY ville');
  assert.equal(r.passed, true);
  assert.equal(r.divergeAt, null);
});

test('HAVING manquant : on compare au SELECT de la solution', () => {
  const sol = 'SELECT c.ville, SUM(o.montant) AS total FROM clients c JOIN commandes o ON o.client_id = c.id GROUP BY c.ville HAVING SUM(o.montant) > 80';
  const r = explainAttempt(SHOP, sol, 'SELECT c.ville, SUM(o.montant) AS total FROM clients c JOIN commandes o ON o.client_id = c.id GROUP BY c.ville');
  assert.match(r.divergeNote ?? '', /HAVING/);
  assert.equal(r.steps[r.divergeAt ?? -1].kind, 'select');
  assert.equal(r.expectedStep?.kind, 'select');
  assert.deepEqual(r.expectedStep?.rows, [['Paris', '99.9']]);
});

// ───────────── Syntaxe du cours : FROM R1, R2 WHERE … ─────────────

test('jointure à la virgule : produit cartésien, puis le WHERE garde les bonnes lignes', () => {
  const r = explain(SHOP, 'SELECT c.nom, o.montant FROM clients c, commandes o WHERE o.client_id = c.id');
  assert.deepEqual(r.steps.map((s) => s.kind), ['from', 'join', 'where', 'select']);
  const join = r.steps[1];
  assert.equal(join.title, 'PRODUIT CARTÉSIEN');
  assert.equal(join.comma, true);
  assert.equal(join.total, 16); // 4 clients × 4 commandes
  assert.equal((r.steps[2].keep ?? []).filter(Boolean).length, 4);
});

test('JOIN … ON garde son titre', () => {
  const r = explain(SHOP, 'SELECT c.nom FROM clients c JOIN commandes o ON o.client_id = c.id');
  assert.equal(r.steps[1].title, 'JOIN');
  assert.equal(r.steps[1].comma, false);
});

test('même résultat écrit à la virgule ou avec JOIN : aucune divergence', () => {
  const sol = 'SELECT c.nom, o.montant FROM clients c JOIN commandes o ON o.client_id = c.id ORDER BY c.nom, o.montant';
  const r = explainAttempt(SHOP, sol, 'SELECT c.nom, o.montant FROM clients c, commandes o WHERE o.client_id = c.id ORDER BY c.nom, o.montant');
  assert.equal(r.passed, true);
  assert.equal(r.divergeAt, null);
});

test('condition de jointure oubliée (produit cartésien) : l’erreur est montrée à l’étape du produit', () => {
  const sol = 'SELECT c.nom, o.montant FROM clients c JOIN commandes o ON o.client_id = c.id';
  const r = explainAttempt(SHOP, sol, 'SELECT c.nom, o.montant FROM clients c, commandes o');
  assert.equal(r.passed, false);
  assert.equal(r.steps[r.divergeAt ?? -1].kind, 'join');
  assert.match(r.divergeNote ?? '', /condition de jointure/);
  assert.ok(r.expectedStep);
});

test('mauvaise condition à la virgule, solution à la virgule aussi : comparée étape par étape', () => {
  const sol = 'SELECT c.nom FROM clients c, commandes o WHERE o.client_id = c.id AND o.montant > 50';
  const r = explainAttempt(SHOP, sol, 'SELECT c.nom FROM clients c, commandes o WHERE o.client_id = c.id AND o.montant > 10');
  assert.equal(r.passed, false);
  assert.equal(r.steps[r.divergeAt ?? -1].kind, 'where');
});

test('étape fautive pour l’analyse : un WHERE oublié est un problème de WHERE, pas de SELECT', () => {
  const sol = "SELECT nom FROM clients WHERE ville = 'Amiens' ORDER BY nom";
  const r = explainAttempt(SHOP, sol, 'SELECT nom FROM clients ORDER BY nom');
  assert.equal(r.divergeKind, 'where');
  assert.equal(r.steps[r.divergeAt ?? -1].kind, 'select'); // l'animation, elle, s'arrête sur l'étape suivante
});

test('étape fautive : JOIN oublié, HAVING oublié, produit cartésien', () => {
  const left = 'SELECT c.nom, COUNT(o.id) AS nb FROM clients c LEFT JOIN commandes o ON o.client_id = c.id GROUP BY c.id, c.nom';
  assert.equal(explainAttempt(SHOP, left, left.replace('LEFT JOIN', 'JOIN')).divergeKind, 'join');
  const having = 'SELECT c.ville, SUM(o.montant) AS total FROM clients c JOIN commandes o ON o.client_id = c.id GROUP BY c.ville HAVING SUM(o.montant) > 80';
  assert.equal(explainAttempt(SHOP, having, having.replace(' HAVING SUM(o.montant) > 80', '')).divergeKind, 'having');
  const sol = 'SELECT c.nom, o.montant FROM clients c JOIN commandes o ON o.client_id = c.id';
  assert.equal(explainAttempt(SHOP, sol, 'SELECT c.nom, o.montant FROM clients c, commandes o').divergeKind, 'join');
});
