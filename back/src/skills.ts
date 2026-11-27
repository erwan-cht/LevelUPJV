// Arbre de compétences (W-04) : chaque compétence du référentiel BUT est une branche, ses défis des nœuds répartis en paliers
// (facile → moyen → difficile) qui se débloquent au fur et à mesure.
//
// Le palier suivant se débloque quand la moitié du précédent est réussie. C'est une aide à la progression : un défi « verrouillé »
// reste jouable, l'arbre indique seulement ce qui est recommandé.
import { Router } from 'express';
import { requireAuth } from './auth.js';
import { prisma } from './db.js';

export const skillsRouter = Router();

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
const ORDER: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const UNLOCK_RATIO = 0.5;

export interface Rank {
  key: 'novice' | 'apprenti' | 'confirme' | 'expert' | 'maitre';
  label: string;
}

/** Rang de maîtrise d'une compétence (0 à 100 % de ses défis réussis). */
export function rankOf(value: number): Rank {
  if (value >= 100) return { key: 'maitre', label: 'Maître' };
  if (value >= 75) return { key: 'expert', label: 'Expert' };
  if (value >= 50) return { key: 'confirme', label: 'Confirmé' };
  if (value >= 25) return { key: 'apprenti', label: 'Apprenti' };
  return { key: 'novice', label: 'Novice' };
}

/**
 * Les apprentissages critiques d'une compétence se débloquent par seuils réguliers de maîtrise
 * (avec 3 apprentissages : à 34 %, 67 % et 100 %), dans l'ordre où le référentiel les liste.
 */
export function skillStates(skills: string[], value: number): { label: string; unlocked: boolean; at: number }[] {
  return skills.map((label, i) => {
    const at = Math.ceil(((i + 1) / skills.length) * 100);
    return { label, unlocked: value >= at, at };
  });
}

export interface TierInput {
  difficulty: Difficulty;
  ids: number[];
}

/** Un palier est ouvert s'il est le premier, ou si la moitié du palier précédent est réussie (un palier précédent vide ne bloque pas). */
export function unlockedTiers(tiers: TierInput[], solved: Set<number>): boolean[] {
  return tiers.map((_, i) => {
    if (i === 0) return true;
    const before = tiers[i - 1].ids;
    if (before.length === 0) return true;
    return before.filter((id) => solved.has(id)).length / before.length >= UNLOCK_RATIO;
  });
}

export type NodeStatus = 'done' | 'available' | 'locked';

export async function skillTree(userId: number) {
  const [competences, passed] = await Promise.all([
    prisma.competence.findMany({
      orderBy: { id: 'asc' },
      include: {
        challenges: {
          where: { challenge: { status: 'PUBLISHED' } },
          include: { challenge: { select: { id: true, title: true, difficulty: true, basePoints: true, minutes: true } } },
        },
      },
    }),
    // Même règle que le reste de la plateforme : un défi compte quand il est réussi hors duel.
    prisma.attempt.findMany({ where: { userId, status: 'PASSED', duelId: null }, distinct: ['challengeId'], select: { challengeId: true } }),
  ]);
  const solved = new Set(passed.map((p) => p.challengeId));

  const branches = competences.map((c) => {
    const items = c.challenges.map((x) => x.challenge);
    const tiers: TierInput[] = ORDER.map((difficulty) => ({ difficulty, ids: items.filter((i) => i.difficulty === difficulty).map((i) => i.id) })).filter((t) => t.ids.length > 0);
    const open = unlockedTiers(tiers, solved);

    const done = items.filter((i) => solved.has(i.id)).length;
    const value = items.length ? Math.round((done / items.length) * 100) : 0;

    return {
      id: c.id,
      name: c.name,
      description: c.description,
      value,
      done,
      total: items.length,
      rank: rankOf(value),
      skills: skillStates(c.skills, value),
      tiers: tiers.map((t, i) => ({
        difficulty: t.difficulty,
        unlocked: open[i],
        done: t.ids.filter((id) => solved.has(id)).length,
        total: t.ids.length,
        nodes: items
          .filter((x) => x.difficulty === t.difficulty)
          .sort((a, b) => a.id - b.id)
          .map((x) => ({
            id: x.id,
            title: x.title,
            points: x.basePoints,
            minutes: x.minutes,
            status: (solved.has(x.id) ? 'done' : open[i] ? 'available' : 'locked') as NodeStatus,
          })),
      })),
    };
  });

  // Défi conseillé : le plus accessible dans la compétence la moins maîtrisée (parmi celles qui ont encore un défi à jouer).
  let next: { id: number; title: string; competence: string; difficulty: Difficulty } | null = null;
  const weakFirst = [...branches].filter((b) => b.total > 0).sort((a, b) => a.value - b.value || a.id - b.id);
  for (const b of weakFirst) {
    const tier = b.tiers.find((t) => t.unlocked && t.nodes.some((n) => n.status === 'available'));
    const node = tier?.nodes.find((n) => n.status === 'available');
    if (tier && node) {
      next = { id: node.id, title: node.title, competence: b.name, difficulty: tier.difficulty };
      break;
    }
  }

  const total = branches.reduce((n, b) => n + b.total, 0);
  const done = branches.reduce((n, b) => n + b.done, 0);
  const withChallenges = branches.filter((b) => b.total > 0);
  return {
    branches,
    next,
    totals: {
      done,
      total,
      mastery: withChallenges.length ? Math.round(withChallenges.reduce((n, b) => n + b.value, 0) / withChallenges.length) : 0,
    },
  };
}

skillsRouter.get('/skills/tree', requireAuth('STUDENT'), async (req, res) => {
  res.json(await skillTree(req.auth!.sub));
});
