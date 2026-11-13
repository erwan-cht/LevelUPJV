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

### Page d'accueil (tableau de bord) : `front/`

Fidèle à la maquette, et adaptée au mobile.

| Bloc | Composant |
|---|---|
| En-tête et navigation | `Header.tsx` |
| Carte de bienvenue (niveau, XP, stats) | `HeroCard.tsx` |
| Mes défis (onglets En cours / Recommandés / Terminés) | `MyChallenges.tsx` |
| Mon activité (graphique sur 7 jours) | `Activity.tsx` |
| Badges et prochain badge | `Badges.tsx` |
| Classement (onglets Promo / Groupe) | `Ranking.tsx` |
| Objectifs du jour et série | `DailyObjectives.tsx` |
| Bannière des duels | `DuelBanner.tsx` |
| Composants communs (Card, ProgressBar, Avatar, Tabs…) | `ui.tsx` |

Autres fichiers :
- `src/types.ts` : types des données (User, Challenge, RankingEntry…), qui serviront aussi de contrat avec le back.
- `src/data/mock.ts` : **données factices**.
- `src/index.css` : couleurs de la charte (`navy`, `brand`…) et police Poppins.

### Toutes les pages du Figma (données factices) : `front/src/pages/`

Routage avec **React Router**, connexion factice (rôle mémorisé dans le navigateur), mise en page commune (en-tête, pied de page, menu burger mobile).

| Route | Page | Fichier |
|---|---|---|
| `/connexion` | Connexion (onglets Étudiant / Enseignant) | `Connexion.tsx` |
| `/` | Tableau de bord | `Dashboard.tsx` |
| `/defis` | Catalogue de défis (recherche, filtres, favoris) | `Defis.tsx` |
| `/defis/:id` | Page d'un défi SQL (éditeur, résultat, indices IA) | `DefiDetail.tsx` |
| `/classement` | Classement (podium, tableau, ligues, points par semaine) | `Classement.tsx` |
| `/duels` | Préparer un duel, invitations, camarades en ligne | `Duels.tsx` |
| `/duels/en-direct` | Duel en direct (chrono, éditeur, tests, fil) | `DuelLive.tsx` |
| `/profil` | Profil (onglets Aperçu, Badges, Historique, Compétences BUT) | `Profil.tsx` |
| `/succes` | Tous les succès (pagination, réclamer) | `Succes.tsx` |
| `/enseignant` | Tableau de bord enseignant (Mes promos) | `teacher/MesPromos.tsx` |
| `/enseignant/challenges` | Créer un défi | `teacher/CreerDefi.tsx` |
| `/enseignant/competences`, `/enseignant/aide` | Compétences BUT, aide | `teacher/` |

Données factices : `src/data/mock.ts`, `catalog.ts`, `community.ts`, `teacher.ts`.

### Visualiser la page

```powershell
cd front
npm install      # la première fois seulement
npm run dev      # puis ouvrir http://localhost:5173
```

Mode mobile : **F12**, puis **Ctrl + Shift + M**.

## 5. Point important : les données sont factices

Les chiffres affichés (Oscar, 2 450 pts, niveau 7…) sont **écrits en dur** dans `src/data/mock.ts`. Il n'y a encore **ni comptes, ni base de données, ni back-end**.

C'est voulu : construire l'interface avec des *mocks* permet de valider le rendu et d'avancer front et back en parallèle.

## 6. Prochaines étapes

### Version minimale

1. Page de **connexion et d'inscription**, avec redirection quand on n'est pas connecté.
2. **Back-end** : Express + Prisma + PostgreSQL (sous Docker), inscription et connexion.
3. Remplacer les mocks par des **appels à l'API** (`GET /api/me`, `GET /api/classement`…).
4. Liste des défis et **soumission avec tests** (défis SQL d'abord).
5. Calcul de l'XP, des niveaux et du classement.

### Ensuite

- React Router et les autres pages (Défis, Classement, Duels, Mon profil).
- Menu burger sur mobile.
- Badges, objectifs du jour, graphique d'activité avec de vraies données.

### Bonus

- **Duels en temps réel** (Socket.IO).
- Connexion via le **CAS UPJV**.
- Défis dans d'autres langages (Judge0 ou Docker).

> ⚠️ Les deux parties les plus difficiles sont les **duels en temps réel** et l'**exécution du code dans un bac à sable** : à attaquer une fois la base solide.

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
