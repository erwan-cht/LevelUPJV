# LevelUPJV : résumé du projet

> État au 13/11/2026

## 1. Le projet

Plateforme de défis de programmation **gamifiée** pour les étudiants du BUT Informatique : défis validés par des tests automatiques, XP et niveaux, classement (promo et groupe), badges, objectifs du jour, séries de jours et duels en temps réel.

Équipe : **3 étudiants de BUT3 Informatique**.

## 2. Choix de la stack (version allégée)

| Couche | Techno | Rôle |
|---|---|---|
| Front | **React + Vite + TypeScript** | Interface (tableau de bord, défis, classement…) |
| Style | **Tailwind CSS** | Mise en forme rapide, fidèle à la maquette |
| Back | **Node.js + Express** (ou Fastify) **+ TypeScript** | API REST |
| Base de données | **PostgreSQL + Prisma** | Comptes, défis, points, badges… |
| Temps réel | **Socket.IO** | Uniquement pour les duels |
| Environnement | **Docker Compose** | PostgreSQL identique pour toute l'équipe |
| CI | **GitHub Actions** | Vérification automatique du code |

### Pourquoi cette stack

- **Un seul langage partout** (TypeScript) : les 3 membres peuvent travailler sur le front comme sur le back.
- Écosystème très documenté, compétences recherchées en stage et en alternance.

### Ce qu'on a volontairement écarté (pour l'instant)

| Écarté | Raison | Remplacé par |
|---|---|---|
| NestJS | Trop de notions à apprendre | Express / Fastify |
| Redis | Inutile pour une promo de 100 à 200 étudiants | `ORDER BY points` dans PostgreSQL |
| Judge0 auto-hébergé | Lourd à installer (WSL2, plusieurs conteneurs) | Défis SQL dans une base SQLite jetable d'abord |
| CAS UPJV | Nécessite l'accord de la DSI | Connexion email + mot de passe (CAS en bonus) |
| Monorepo | Configuration fastidieuse | Deux dossiers `front/` et `back/` |

## 3. Notions clés

### Prisma (ORM)

Fait le lien entre le code TypeScript et PostgreSQL.

- Les tables sont décrites dans un seul fichier, `schema.prisma`.
- Les **migrations** sont versionnées dans Git : toute l'équipe a la même structure de base.
- Les requêtes s'écrivent en TypeScript, **typées et avec autocomplétion** :
  ```ts
  const top = await prisma.user.findMany({ orderBy: { points: 'desc' }, take: 10 });
  ```
- Protège contre les injections SQL. `npx prisma studio` ouvre une interface pour voir les données.

### Docker

Fait tourner les logiciels dans des **conteneurs** identiques sur toutes les machines.

- **Environnement de dev** : `docker compose up -d` lance PostgreSQL, à l'identique pour les 3 membres.
- **Exécution du code des étudiants** : conteneurs jetables, isolés et limités en temps et en mémoire, pour protéger le serveur.
- **Déploiement** : on déploie ce qui tourne en local.
- ⚠️ Sous Windows, Docker Desktop a besoin de **WSL2**.

## 4. Ce qui est fait

Le projet fonctionne de bout en bout : **front React, API Express et base PostgreSQL**, pour les trois profils (étudiant, enseignant, administrateur). Le détail technique est dans [`documentation.md`](documentation.md).

### Front : `front/`

Fidèle aux maquettes, adapté au mobile, avec routage **React Router**, connexion par jeton, mise en page commune (en-tête, pied de page, menu burger mobile).

| Route | Page | Fichier |
|---|---|---|
| `/connexion` | Connexion (onglets Étudiant / Enseignant) | `Connexion.tsx` |
| `/` | Tableau de bord | `Dashboard.tsx` |
| `/defis` | Catalogue de défis (recherche, filtres, favoris) | `Defis.tsx` |
| `/defis/:id` | Page d'un défi SQL (éditeur, correction, indices) | `DefiDetail.tsx` |
| `/classement` | Classement (podium, tableau, ligues, points par semaine) | `Classement.tsx` |
| `/duels` | Préparer un duel, invitations, camarades de la promo | `Duels.tsx` |
| `/duels/:id` | Duel en direct (chrono, éditeur, progression, fil) | `DuelLive.tsx` |
| `/profil` | Profil (onglets Aperçu, Badges, Historique, Compétences BUT) | `Profil.tsx` |
| `/succes` | Tous les succès (progression, réclamer) | `Succes.tsx` |
| `/enseignant`, `/enseignant/challenges`, `/enseignant/competences`, `/enseignant/aide` | Espace enseignant | `teacher/` |
| `/admin`, `/admin/promotions`, `/admin/contenus`, `/admin/referentiel` | Espace administrateur | `admin/` |

Aucune donnée n'est écrite en dur dans le front : chaque page lit l'API.

### Base de données et API : `back/`

- PostgreSQL sous Docker, schéma Prisma, migrations versionnées, données de démonstration (`npm run db:seed`).
- API Express : connexion (JWT), tableau de bord, défis avec **correction SQL automatique**, classement avec évolution du rang, badges avec règles, profil, **duels** (invitation, chrono, victoire), espace enseignant (statistiques, assignation de défis, création de défis), espace administrateur (comptes, promotions, contenus, référentiel, journal).

### Lancer le projet

```powershell
cd back
npm install
npm run db:up        # Docker Desktop démarré
npm run db:migrate
npm run db:seed
npm run dev          # API sur http://localhost:3001
```

```powershell
cd front
npm install
npm run dev          # site sur http://localhost:5173
```

Comptes : `oscar.lescot` (étudiant), `m.dupuis` (enseignant), `admin.dsi` (administrateur), mot de passe `levelup123`. Mode mobile : **F12**, puis **Ctrl + Shift + M**.

## 5. Ce qui n'est pas encore fait

- Correction automatique des défis algorithmique et web (aujourd'hui seuls les défis SQL sont corrigés, donc seuls eux servent aux duels).
- Duels en temps réel par WebSocket (aujourd'hui l'état est relu toutes les 2 secondes).
- Vrais indices IA, envoi d'e-mails, arène live.
- Tests automatiques et CI.

La liste complète des limites est dans [`documentation.md`](documentation.md) (§ 9 et 10).

## 6. Prochaines étapes

1. Défis algorithmique et web corrigés dans des conteneurs isolés.
2. Socket.IO pour les duels, puis l'arène live en amphi.
3. Indices IA, envoi d'e-mails.
4. Pistes « effet wow » ci-dessous.

### Pistes « effet wow » (facultatives, à ne pas toutes faire)

Par ordre de priorité conseillé. Détails dans `docs/cahier-des-charges.md` (§6).

| # | Piste | Effort | Impact | Dépend de |
|---|---|---|---|---|
| W-01 | **Visualisation de l'exécution SQL** (signature) : animation FROM, JOIN, WHERE, GROUP BY, et étape où le résultat diverge | Très élevé | Très élevé | Défis SQL avec tests |
| W-02 | **Arène live en amphi** : session lancée par le prof, QR code, classement en direct au vidéoprojecteur | Élevé | Très élevé | Socket.IO, comptes |
| W-03 | **Analyse de la salle en direct** après l'arène (erreurs fréquentes, question bloquante) | Faible | Élevé | W-02 |
| W-04 | **Arbre de compétences façon RPG** calqué sur le référentiel BUT | Moyen | Élevé | Compétences en base |
| W-05 | **Tuteur IA branché sur la visualisation** : pointe l'étape fautive, l'animation y saute | Moyen | Élevé | W-01 |
| W-06 | **Génération de défis pour les profs** à partir d'un schéma de BDD | Moyen | Élevé | Défis SQL |
| W-07 | **Game feel** : animations, sons, transitions (1 à 2 semaines en fin de projet) | Moyen | Moyen/Élevé | Socle terminé |

**Conseils :**
- Faire un **prototype rapide de W-01** dans les premières semaines et le montrer à un enseignant.
- Priorité : W-01 (signature) + W-02 (moment de démo), puis W-03 (meilleur rapport effort/effet).
- Réserver 1 à 2 semaines en fin de projet pour W-07.
- Faire au moins un **test réel avec une autre classe** (20 min en fin de TD BDD).

**Démo cible :** arbre de compétences, puis défi SQL raté et corrigé grâce à la visualisation et au tuteur, puis QR code pour lancer l'arène avec le jury, puis analyse de leurs erreurs en direct.
