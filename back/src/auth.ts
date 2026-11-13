import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

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

/** Exige un jeton valide, éventuellement limité à certains rôles. */
export const requireAuth =
  (...roles: AuthPayload['role'][]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    try {
      const payload = jwt.verify(token, SECRET) as unknown as AuthPayload;
      if (roles.length > 0 && !roles.includes(payload.role)) {
        res.status(403).json({ error: 'Accès refusé pour ce profil.' });
        return;
      }
      req.auth = { sub: Number(payload.sub), role: payload.role };
      next();
    } catch {
      res.status(401).json({ error: 'Non connecté.' });
    }
  };
