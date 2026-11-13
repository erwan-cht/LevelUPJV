import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './db.js';

// En production, JWT_SECRET doit être défini. Valeur de repli pour le développement uniquement.
const SECRET = process.env.JWT_SECRET ?? 'levelupjv-dev-secret-a-changer';

export interface AuthPayload {
  sub: number;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
}

export const signToken = (payload: AuthPayload) => jwt.sign(payload, SECRET, { expiresIn: '7d' });

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthPayload;
  }
}

/**
 * Exige un jeton valide, éventuellement limité à certains rôles.
 * Le compte est relu en base à chaque requête : un compte suspendu ou supprimé perd l'accès
 * immédiatement, sans attendre l'expiration du jeton. On en profite pour noter la présence
 * (« en ligne »), au plus une fois par minute.
 */
export const requireAuth =
  (...roles: AuthPayload['role'][]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';

    let payload: AuthPayload;
    try {
      payload = jwt.verify(token, SECRET) as unknown as AuthPayload;
    } catch {
      res.status(401).json({ error: 'Non connecté.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      select: { id: true, role: true, status: true, lastSeenAt: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({ error: user ? 'Ce compte n’est plus actif.' : 'Non connecté.' });
      return;
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      res.status(403).json({ error: 'Accès refusé pour ce profil.' });
      return;
    }

    if (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > 60_000) {
      await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    }
    req.auth = { sub: user.id, role: user.role };
    next();
  };
