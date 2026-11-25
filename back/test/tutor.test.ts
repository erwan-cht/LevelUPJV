import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explainAttempt } from '../src/sqlsteps.js';
import { promptFor, tutor } from '../src/tutor.js';

const SHOP = `
CREATE TABLE clients (id INTEGER PRIMARY KEY, nom TEXT, ville TEXT);
CREATE TABLE commandes (id INTEGER PRIMARY KEY, client_id INTEGER, montant REAL, date_commande TEXT);
INSERT INTO clients VALUES (1,'Alice','Amiens'),(2,'Bob','Paris'),(3,'Chloé','Amiens'),(4,'David','Lille');
INSERT INTO commandes VALUES (1,1,45.0,'2026-01-10'),(2,1,20.0,'2026-02-02'),(3,2,99.9,'2026-02-14'),(4,3,12.5,'2026-03-01');
`;
const SOLUTION = 'SELECT c.ville, SUM(o.montant) AS total FROM clients c JOIN commandes o ON o.client_id = c.id GROUP BY c.ville HAVING SUM(o.montant) > 80';
const WRONG = 'SELECT c.ville, SUM(o.montant) AS total FROM clients c JOIN commandes o ON o.client_id = c.id GROUP BY c.ville';
const STATEMENT = 'Pour chaque ville, calcule le total des commandes, en ne gardant que les villes dont le total dépasse 80 €.';

test('le prompt ne contient ni la solution ni ses valeurs', () => {
  const r = explainAttempt(SHOP, SOLUTION, WRONG);
  const prompt = promptFor(STATEMENT, WRONG, r) ?? '';
  assert.ok(prompt.includes('<requete_etudiant>'));
  assert.match(prompt, /Il manque un HAVING/); // le constat nomme la clause manquante, sans la donner
  assert.ok(!prompt.includes('> 80'), 'la clause HAVING de la solution ne doit pas fuiter');
  assert.ok(!prompt.includes('99.9'), 'les valeurs attendues ne doivent pas fuiter');
  assert.match(prompt, /bonne solution en produit 1/);
});

test('rien à dire quand la réponse est juste', async () => {
  const r = explainAttempt(SHOP, SOLUTION, SOLUTION);
  assert.equal(promptFor(STATEMENT, SOLUTION, r), null);
  assert.equal(await tutor(STATEMENT, SOLUTION, r), null);
});

test('sans clé API : message construit, et saut vers la bonne étape', async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const r = explainAttempt(SHOP, SOLUTION, WRONG);
    const t = await tutor(STATEMENT, WRONG, r);
    assert.ok(t);
    assert.equal(t.source, 'rules');
    assert.equal(t.stepIndex, r.divergeAt);
    assert.match(t.text, /HAVING/);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});
