import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import { api } from './routes.js';

const app = express();
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', api);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Route inconnue.' });
});

// Gestion d'erreur : on ne renvoie jamais la trace au client.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur.' });
});

const port = Number(process.env.PORT ?? 3001);
// Écoute en local uniquement : en production, c'est nginx qui expose l'API.
const host = process.env.HOST ?? '127.0.0.1';
app.listen(port, host, () => console.log(`API LevelUPJV : http://${host}:${port}/api`));
