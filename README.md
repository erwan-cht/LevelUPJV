# LevelUPJV

Plateforme de défis de programmation gamifiée pour les étudiants du BUT Informatique (IUT d'Amiens) : XP, niveaux, classement, badges, duels.

## Stack

- **Front** : React + Vite + TypeScript + Tailwind CSS + React Router (`front/`)
- **Base de données** : PostgreSQL + Prisma, sous Docker Compose (`back/`, `docker-compose.yml`)
- **API** : Node + Express + TypeScript (`back/src/`), jetons JWT ; Socket.IO à venir pour les duels

## Lancer le projet (base + API + front)

Trois terminaux (la base de données doit être prête, voir plus bas) :

```bash
cd back && npm run db:up      # PostgreSQL (Docker Desktop démarré)
cd back && npm run dev        # API sur http://localhost:3001
cd front && npm run dev       # site sur http://localhost:5173
```

Comptes de test (mot de passe `levelup123`) : `oscar.lescot` (étudiant), `m.dupuis` (enseignant), `admin.dsi` (administrateur).

## Lancer le front seul

```bash
cd front
npm install
npm run dev      # http://localhost:5173
npm run build    # vérification des types + build de production
```

Toutes les pages (étudiant, enseignant, administrateur) lisent l'API et la base : le front ne contient plus de données factices. L'API doit donc tourner (`cd back && npm run dev`), avec la base démarrée.

## Base de données (PostgreSQL + Prisma)

Prérequis : **Docker Desktop démarré** (sous Windows, avec WSL2).

```bash
cd back
npm install
cp .env.example .env          # une seule fois
npm run db:up                 # démarre PostgreSQL dans Docker
npm run db:migrate           # applique les migrations (crée ou met à jour les tables)
npm run db:generate           # génère le client Prisma (nécessaire avant le seed et l'API)
npm run db:seed               # données de démonstration (comptes : <prénom>.<nom>@etu.example / levelup123)
npm run db:studio             # interface web pour voir les données
```

Le schéma est dans `back/prisma/schema.prisma`. Après l'avoir modifié :
`npm run db:migrate -- --name <description>`, puis commiter le dossier `prisma/migrations/`.

⚠️ `npm run db:seed` **remet les comptes de démonstration à zéro** (mot de passe, activité, badges, duels). Les comptes et défis créés à la main ne sont pas touchés.

## Documentation

| Document | Contenu |
|---|---|
| [`docs/documentation.md`](docs/documentation.md) | Architecture du front, routes, composants, données, conventions |
| [`docs/resume.md`](docs/resume.md) | Choix de stack, avancement, feuille de route |
| [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) | Cahier des charges complet |

## Organisation du dépôt

```
front/       Application React
back/        API Express et base de données (Prisma)
docs/        Documentation
maquettes/   Maquettes HTML d'origine
```

## Équipe

Tom Podsadni, Erwan Christ, Oscar Lescot : BUT 3 Informatique, IUT d'Amiens.
