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

// ───────────── Fournisseur Gemini (faux fetch : aucune clé ni réseau nécessaires) ─────────────

async function withGemini<T>(fake: typeof fetch, run: () => Promise<T>): Promise<T> {
  const saved = { fetch: globalThis.fetch, key: process.env.GEMINI_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY, provider: process.env.TUTOR_PROVIDER };
  globalThis.fetch = fake;
  process.env.GEMINI_API_KEY = 'cle-de-test';
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.TUTOR_PROVIDER;
  try {
    return await run();
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [k, v] of [['GEMINI_API_KEY', saved.key], ['ANTHROPIC_API_KEY', saved.anthropic], ['TUTOR_PROVIDER', saved.provider]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('Gemini : requête bien formée, clé dans l’en-tête, rien de la solution', async () => {
  let url = '';
  let headers: Record<string, string> = {};
  let body = '';
  const fake = (async (input: string | URL | Request, init?: RequestInit) => {
    url = String(input);
    headers = init?.headers as Record<string, string>;
    body = String(init?.body);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Regarde ton GROUP BY : que devrait-il rester ?' }] } }] }), { status: 200 });
  }) as typeof fetch;

  const r = explainAttempt(SHOP, SOLUTION, WRONG);
  const t = await withGemini(fake, () => tutor(STATEMENT, WRONG, r));

  assert.ok(t);
  assert.equal(t.source, 'ai');
  assert.equal(t.text, 'Regarde ton GROUP BY : que devrait-il rester ?');
  assert.equal(t.stepIndex, r.divergeAt);
  assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/.+:generateContent$/);
  assert.ok(!url.includes('cle-de-test'), 'la clé ne doit pas être dans l’URL');
  assert.equal(headers['x-goog-api-key'], 'cle-de-test');
  assert.ok(!body.includes('> 80') && !body.includes('99.9'), 'la solution ne doit pas partir chez le fournisseur');
  assert.ok(body.includes('requete_etudiant'));
});

test('Gemini : erreur du fournisseur → conseil construit sans IA', async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    const fake = (async () => new Response('quota dépassé', { status: 429 })) as typeof fetch;
    const r = explainAttempt(SHOP, SOLUTION, WRONG);
    const t = await withGemini(fake, () => tutor(STATEMENT, WRONG, r));
    assert.equal(t?.source, 'rules');
    assert.equal(t?.stepIndex, r.divergeAt);
  } finally {
    console.error = quiet;
  }
});

test('TUTOR_PROVIDER=none : jamais d’appel réseau', async () => {
  let called = false;
  const fake = (async () => {
    called = true;
    return new Response('{}');
  }) as typeof fetch;
  const r = explainAttempt(SHOP, SOLUTION, WRONG);
  const saved = process.env.TUTOR_PROVIDER;
  const t = await withGemini(fake, async () => {
    process.env.TUTOR_PROVIDER = 'none';
    return tutor(STATEMENT, WRONG, r);
  });
  if (saved === undefined) delete process.env.TUTOR_PROVIDER;
  assert.equal(called, false);
  assert.equal(t?.source, 'rules');
});
