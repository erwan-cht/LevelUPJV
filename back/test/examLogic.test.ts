import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDecision, applyLeave, canWork, clampDuration, endsAtOf, gradeOn20, isOverdue, leaveReason, sortSeats, type Seat } from '../src/examLogic.js';

const T0 = new Date('2026-11-27T10:00:00Z');
const MIN = 60_000;
const active: Seat = { status: 'ACTIVE', leaveCount: 0, lockedAt: null, lockReason: null };

test('durée : bornée entre 5 et 240 min, 60 par défaut', () => {
  assert.equal(clampDuration(45), 45);
  assert.equal(clampDuration('90'), 90);
  assert.equal(clampDuration(1), 5);
  assert.equal(clampDuration(1000), 240);
  assert.equal(clampDuration(undefined), 60);
  assert.equal(clampDuration('abc'), 60);
  assert.equal(clampDuration(-3), 60);
});

test('fin de l’examen et dépassement', () => {
  assert.equal(endsAtOf(null, 60), null);
  assert.equal(endsAtOf(T0, 30), T0.getTime() + 30 * MIN);
  assert.equal(isOverdue('RUNNING', T0, 30, T0.getTime() + 29 * MIN), false);
  assert.equal(isOverdue('RUNNING', T0, 30, T0.getTime() + 30 * MIN), true);
  assert.equal(isOverdue('FINISHED', T0, 30, T0.getTime() + 99 * MIN), false);
  assert.equal(isOverdue('LOBBY', null, 30, T0.getTime() + 99 * MIN), false);
});

test('composer : seulement pendant l’examen, et seulement si la copie n’est pas bloquée', () => {
  const during = T0.getTime() + 10 * MIN;
  assert.equal(canWork('RUNNING', 'ACTIVE', T0, 30, during), true);
  assert.equal(canWork('RUNNING', 'LOCKED', T0, 30, during), false);
  assert.equal(canWork('RUNNING', 'EXCLUDED', T0, 30, during), false);
  assert.equal(canWork('RUNNING', 'SUBMITTED', T0, 30, during), false);
  assert.equal(canWork('LOBBY', 'ACTIVE', null, 30, during), false);
  assert.equal(canWork('FINISHED', 'ACTIVE', T0, 30, during), false);
  // après la fin : refusé, sauf dans la marge réseau
  assert.equal(canWork('RUNNING', 'ACTIVE', T0, 30, T0.getTime() + 30 * MIN + 2000), false);
  assert.equal(canWork('RUNNING', 'ACTIVE', T0, 30, T0.getTime() + 30 * MIN + 2000, 3000), true);
});

test('sortie de page : bloque un étudiant qui compose et compte la sortie', () => {
  const r = applyLeave(active, 'a changé d’onglet', T0);
  assert.equal(r.changed, true);
  assert.deepEqual(r.seat, { status: 'LOCKED', leaveCount: 1, lockedAt: T0, lockReason: 'a changé d’onglet' });
});

test('sortie de page : sans effet sur un étudiant déjà bloqué, exclu ou qui a rendu sa copie', () => {
  for (const status of ['LOCKED', 'EXCLUDED', 'SUBMITTED'] as const) {
    const seat: Seat = { ...active, status, leaveCount: 2 };
    const r = applyLeave(seat, 'x', T0);
    assert.equal(r.changed, false);
    assert.equal(r.seat.leaveCount, 2);
  }
});

test('décision : débloquer remet l’étudiant au travail, en gardant le compte des sorties', () => {
  const locked = applyLeave(active, 'blur', T0).seat;
  const r = applyDecision(locked, 'unlock');
  assert.equal(r.changed, true);
  assert.deepEqual(r.seat, { status: 'ACTIVE', leaveCount: 1, lockedAt: null, lockReason: null });
  // une deuxième sortie bloque à nouveau et s'ajoute au compte
  assert.equal(applyLeave(r.seat, 'blur', T0).seat.leaveCount, 2);
});

test('décision : clore la copie, puis changer d’avis', () => {
  const locked = applyLeave(active, 'blur', T0).seat;
  const closed = applyDecision(locked, 'exclude');
  assert.equal(closed.changed, true);
  assert.equal(closed.seat.status, 'EXCLUDED');
  assert.equal(applyDecision(closed.seat, 'exclude').changed, false);
  assert.equal(applyDecision(closed.seat, 'unlock').seat.status, 'ACTIVE');
});

test('décision : une copie rendue ne bouge plus ; débloquer un étudiant actif ne fait rien', () => {
  const submitted: Seat = { ...active, status: 'SUBMITTED' };
  assert.equal(applyDecision(submitted, 'unlock').changed, false);
  assert.equal(applyDecision(submitted, 'exclude').changed, false);
  assert.equal(applyDecision(active, 'unlock').changed, false);
});

test('raison de sortie : libellé lisible, repli pour une valeur inconnue', () => {
  assert.equal(leaveReason('hidden'), 'a changé d’onglet ou réduit la fenêtre');
  assert.equal(leaveReason('pagehide'), 'a fermé ou rechargé la page');
  assert.equal(leaveReason('<script>'), 'a quitté la page de l’examen');
});

test('note sur 20, au demi-point', () => {
  assert.equal(gradeOn20(0, 4), 0);
  assert.equal(gradeOn20(4, 4), 20);
  assert.equal(gradeOn20(1, 3), 6.5);
  assert.equal(gradeOn20(2, 3), 13.5);
  assert.equal(gradeOn20(0, 0), 0);
});

test('salle côté enseignant : les bloqués d’abord, le plus ancien blocage en tête', () => {
  const seats = sortSeats([
    { name: 'Zoé', status: 'ACTIVE' as const, lockedAt: null },
    { name: 'Bob', status: 'LOCKED' as const, lockedAt: new Date(T0.getTime() + 2000) },
    { name: 'Ana', status: 'SUBMITTED' as const, lockedAt: null },
    { name: 'Léo', status: 'LOCKED' as const, lockedAt: T0 },
    { name: 'Alice', status: 'ACTIVE' as const, lockedAt: null },
  ]);
  assert.deepEqual(seats.map((s) => s.name), ['Léo', 'Bob', 'Alice', 'Zoé', 'Ana']);
});
