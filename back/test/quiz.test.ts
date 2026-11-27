import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkQuestions, sections } from '../src/quiz.js';

const good = (over: Record<string, unknown> = {}) => ({
  question: 'Que fait un WHERE ?',
  choices: ['Il filtre les lignes', 'Il trie les lignes', 'Il regroupe les lignes', 'Il supprime la table'],
  answerIndex: 0,
  explanation: 'Le WHERE sélectionne les lignes qui vérifient la condition.',
  page: 68,
  ...over,
});

test('garde une question bien formée et suit la bonne réponse après mélange', () => {
  const [q] = checkQuestions({ questions: [good()] }, 66, 70);
  assert.ok(q);
  assert.equal(q.choices[q.answer], 'Il filtre les lignes');
  assert.equal(q.choices.length, 4);
  assert.equal(q.page, 68);
});

test('écarte les questions mal formées', () => {
  const bad = [
    good({ choices: ['a', 'b', 'c'] }), // 3 propositions
    good({ choices: ['a', 'a', 'b', 'c'] }), // doublon
    good({ answerIndex: 4 }), // hors plage
    good({ answerIndex: 'x' }),
    good({ question: '   ' }),
    good({ choices: ['a', '', 'c', 'd'] }), // proposition vide
    null,
  ];
  assert.deepEqual(checkQuestions({ questions: bad }, 1, 100), []);
  assert.deepEqual(checkQuestions({ questions: 'non' }, 1, 100), []);
  assert.deepEqual(checkQuestions(null, 1, 100), []);
});

test('une page hors du chapitre est ramenée au début du chapitre', () => {
  const [q] = checkQuestions({ questions: [good({ page: 999 })] }, 66, 70);
  assert.equal(q.page, 66);
});

test('le mélange ne perd jamais la bonne réponse', () => {
  for (let i = 0; i < 50; i++) {
    const [q] = checkQuestions({ questions: [good({ answerIndex: 2 })] }, 1, 100);
    assert.equal(q.choices[q.answer], 'Il regroupe les lignes');
  }
});

test('chapitres : titres numérotés, diapos sans numéro rattachées, parties séparées par le plan', () => {
  const long = 'x'.repeat(320);
  const c = {
    id: 'c',
    title: 'T',
    author: 'A',
    pages: [
      'Introduction\n' + long, // avant le premier chapitre : ignorée
      '1. Historique\n' + long,
      'Exemple simple\n' + long, // rattachée au chapitre 1
      '2. La commande WHERE - Sélection\n' + long,
      '2. La commande WHERE – Jointure\n' + long, // même numéro : même chapitre
      'Plan du Cours\n' + long, // nouvelle partie
      '1. La commande SELECT\n' + long, // la numérotation repart de 1
      '2. Trop bref\nx',
    ],
  };
  assert.deepEqual(sections(c), [
    { id: '2-3', label: '1. Historique', from: 2, to: 3 },
    { id: '4-5', label: '2. La commande WHERE – Sélection', from: 4, to: 5 },
    { id: '7-7', label: '1. La commande SELECT', from: 7, to: 7 },
  ]);
});
