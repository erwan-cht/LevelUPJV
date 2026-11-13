# LevelUPJV

Plateforme de défis de programmation gamifiée (XP, niveaux, classement, badges, duels).

## Stack

- **Front** : React + Vite + TypeScript + Tailwind CSS (`front/`)
- **Back** (à venir) : Node + Express + TypeScript, PostgreSQL + Prisma, Socket.IO

## Lancer le front

```bash
cd front
npm install
npm run dev      # http://localhost:5173
npm run build    # vérification des types + build de production
```

Les données affichées sont pour l'instant factices : `front/src/data/mock.ts`.

## Base de données (PostgreSQL + Prisma)

Prérequis : **Docker Desktop démarré** (sous Windows, avec WSL2).

```bash
cd back
npm install
cp .env.example .env          # une seule fois
npm run db:up                 # démarre PostgreSQL dans Docker
npm run db:migrate -- --name init   # crée les tables
npm run db:seed               # données de test (comptes : <prénom>.<nom>@etu.example / levelup123)
npm run db:studio             # interface web pour voir les données
```

Le schéma est dans `back/prisma/schema.prisma`. Après l'avoir modifié :
`npm run db:migrate -- --name <description>`, puis commiter le dossier `prisma/migrations/`.
