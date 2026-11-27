import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyse, leaderboard, newJoinCode, normalizeCode, pointsFor, resultOf, type Attempt } from '../src/arenaLogic.js';

const LIMIT = 240_000;
const at = (userId: number, correct: boolean, elapsedMs: number, failedStep: string | null = null, challengeId = 1): Attempt => ({
  userId,
  challengeId,
  correct,
  failedStep,
  elapsedMs,
});

test('points : plus on est rapide, plus on gagne ; les ratés coûtent', () => {
  assert.equal(pointsFor(0, 0, LIMIT), 1000);
  assert.equal(pointsFor(LIMIT / 2, 0, LIMIT), 750);
  assert.equal(pointsFor(LIMIT, 0, LIMIT), 500);
  assert.equal(pointsFor(LIMIT * 2, 0, LIMIT), 500); // jamais sous la base une fois réussi
  assert.equal(pointsFor(0, 2, LIMIT), 900);
  assert.equal(pointsFor(LIMIT, 40, LIMIT), 200); // plancher
});

test('résultat : la première bonne réponse compte, les erreurs d’avant pénalisent', () => {
  const r = resultOf([at(1, false, 20_000, 'WHERE'), at(1, true, 60_000), at(1, true, 90_000)], LIMIT);
  assert.equal(r.solved, true);
  assert.equal(r.attempts, 3);
  assert.equal(r.solvedAtMs, 60_000);
  assert.equal(r.points, pointsFor(60_000, 1, LIMIT));
  assert.deepEqual(resultOf([at(1, false, 5_000, 'JOIN')], LIMIT), { solved: false, attempts: 1, points: 0, solvedAtMs: null });
  assert.deepEqual(resultOf([], LIMIT), { solved: false, attempts: 0, points: 0, solvedAtMs: null });
});

test('classement : points, puis défis réussis, puis ordre d’arrivée ; ex æquo = même rang', () => {
  const attempts = [
    at(10, true, 10_000), // 10 : 1 défi, rapide
    at(20, true, 100_000), // 20 : plus lent
    at(30, false, 5_000, 'JOIN'), // 30 : rien
  ];
  const board = leaderboard([30, 20, 10, 40], attempts, LIMIT);
  assert.deepEqual(board.map((r) => r.userId), [10, 20, 30, 40]);
  assert.deepEqual(board.map((r) => r.rank), [1, 2, 3, 3]); // 30 et 40 : 0 point, 0 défi → ex æquo
});

test('classement : somme sur plusieurs défis', () => {
  const attempts = [at(1, true, 0, null, 1), at(1, true, 0, null, 2), at(2, true, 0, null, 1)];
  const board = leaderboard([1, 2], attempts, LIMIT);
  assert.equal(board[0].userId, 1);
  assert.equal(board[0].points, 2000);
  assert.equal(board[0].solved, 2);
});

test('analyse de la salle : étape de la première erreur, réussite, temps moyen', () => {
  // 10 étudiants dans la salle : 4 butent d'abord sur JOIN, 1 sur WHERE, 3 réussissent du premier coup, 2 n'ont rien envoyé.
  const attempts: Attempt[] = [
    at(1, false, 10_000, 'JOIN'), at(1, true, 50_000),
    at(2, false, 12_000, 'JOIN'),
    at(3, false, 15_000, 'JOIN'), at(3, true, 70_000),
    at(4, false, 18_000, 'JOIN'),
    at(5, false, 20_000, 'WHERE'),
    at(6, true, 30_000), at(7, true, 40_000), at(8, true, 50_000),
  ];
  const a = analyse(10, attempts, LIMIT);
  assert.equal(a.participants, 10);
  assert.equal(a.answered, 8);
  assert.equal(a.solved, 5);
  assert.equal(a.successPct, 50);
  assert.equal(a.stuck, 3);
  assert.equal(a.byStep[0].step, 'JOIN');
  assert.equal(a.byStep[0].count, 4);
  assert.equal(a.byStep[0].pct, 80); // 4 des 5 étudiants qui se sont trompés
  assert.equal(a.byStep[1].step, 'WHERE');
  assert.equal(a.avgSolveSec, Math.round((50 + 70 + 30 + 40 + 50) / 5));
});

test('analyse : salle vide ou personne ne se trompe', () => {
  const empty = analyse(0, [], LIMIT);
  assert.equal(empty.successPct, 0);
  assert.equal(empty.avgSolveSec, null);
  assert.deepEqual(empty.byStep, []);
  const perfect = analyse(2, [at(1, true, 1000), at(2, true, 2000)], LIMIT);
  assert.equal(perfect.successPct, 100);
  assert.deepEqual(perfect.byStep, []);
});

test('codes : 5 caractères sans ambiguïté, saisie normalisée', () => {
  for (let i = 0; i < 200; i++) assert.match(newJoinCode(), /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(normalizeCode(' ab-c 12 '), 'ABC12');
  assert.equal(normalizeCode(undefined), '');
});
