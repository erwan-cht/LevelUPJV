import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankOf, skillStates, unlockedTiers, type TierInput } from '../src/skills.js';

test('rangs de maîtrise', () => {
  assert.equal(rankOf(0).key, 'novice');
  assert.equal(rankOf(24).key, 'novice');
  assert.equal(rankOf(25).key, 'apprenti');
  assert.equal(rankOf(50).key, 'confirme');
  assert.equal(rankOf(75).key, 'expert');
  assert.equal(rankOf(99).key, 'expert');
  assert.equal(rankOf(100).label, 'Maître');
});

test('apprentissages critiques : seuils réguliers', () => {
  const s = skillStates(['A', 'B', 'C'], 70);
  assert.deepEqual(s.map((x) => x.at), [34, 67, 100]);
  assert.deepEqual(s.map((x) => x.unlocked), [true, true, false]);
  assert.deepEqual(skillStates(['A'], 99).map((x) => x.unlocked), [false]);
  assert.deepEqual(skillStates([], 50), []);
});

const tiers: TierInput[] = [
  { difficulty: 'EASY', ids: [1, 2] },
  { difficulty: 'MEDIUM', ids: [3, 4, 5, 6] },
  { difficulty: 'HARD', ids: [7] },
];

test('paliers : le premier est ouvert, le suivant s’ouvre à moitié réussi', () => {
  assert.deepEqual(unlockedTiers(tiers, new Set()), [true, false, false]);
  assert.deepEqual(unlockedTiers(tiers, new Set([1])), [true, true, false]); // 1 sur 2 = 50 %
  assert.deepEqual(unlockedTiers(tiers, new Set([1, 2, 3])), [true, true, false]); // 1 sur 4 au palier moyen
  assert.deepEqual(unlockedTiers(tiers, new Set([1, 2, 3, 4])), [true, true, true]);
});

test('un palier précédent vide ne bloque pas', () => {
  assert.deepEqual(unlockedTiers([{ difficulty: 'MEDIUM', ids: [1] }, { difficulty: 'HARD', ids: [2] }], new Set()), [true, false]);
  assert.deepEqual(unlockedTiers([{ difficulty: 'EASY', ids: [] }, { difficulty: 'HARD', ids: [2] }], new Set()), [true, true]);
});
