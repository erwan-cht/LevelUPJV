import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL manquant : copiez back/.env.example en back/.env');
}

// Prisma 7 : le client passe par un « driver adapter » (ici le driver pg).
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
