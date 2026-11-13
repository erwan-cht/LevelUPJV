# LevelUPJV : documentation technique

> État au 13/11/2026. Ce document décrit l'existant : le front avec données factices. Le back-end n'est pas encore développé.
> Voir aussi : [`resume.md`](resume.md) (choix de stack, feuille de route) et [`cahier-des-charges.md`](cahier-des-charges.md) (besoins).

## 1. Vue d'ensemble

LevelUPJV est une plateforme de défis de programmation gamifiée pour les étudiants du BUT Informatique (IUT d'Amiens). Les défis sont corrigés automatiquement. Les étudiants gagnent des points, montent de niveau, se comparent au classement et s'affrontent en duel. Les enseignants suivent la promo et créent des défis.

```
LevelUPJV/
├── front/        Application React (existante)
├── back/         Base de données Prisma (schéma, migrations, seed) ; API à venir
├── docker-compose.yml   PostgreSQL pour le développement
├── docs/         Documentation (ce dossier)
├── maquettes/    Maquettes HTML d'origine
└── README.md
```

## 2. Stack

| Couche | Techno | Statut |
|---|---|---|
| Front | React 19, Vite 8, TypeScript (mode strict) | Fait |
| Style | Tailwind CSS 4 (plugin Vite) | Fait |
| Routage | React Router 7 (`react-router-dom`) | Fait |
| Icônes | `lucide-react` | Fait |
| Police | Poppins (Google Fonts) | Fait |
| Back | Node.js, Express ou Fastify, TypeScript | À venir |
| Base de données | PostgreSQL 16 et Prisma 7 (Docker Compose) | Fait (Erwan) |
| API | Express 5, jetons JWT (`jsonwebtoken`), mots de passe `bcryptjs` | Premières routes faites |
| Temps réel | Socket.IO (duels) | À venir |
| Environnement | Docker Compose (PostgreSQL) | Fait |
| CI | GitHub Actions | À venir |

## 3. Lancer le projet

Prérequis : Node.js récent et npm.

```bash
cd front
npm install
npm run dev       # http://localhost:5173
npm run build     # vérification des types (tsc) puis build de production
npm run preview   # sert le build de production
```

**Lancer toute la chaîne** (base, API, front, dans trois terminaux) :

```bash
cd back && npm run db:up     # PostgreSQL (Docker Desktop démarré)
cd back && npm run dev       # API : http://localhost:3001
cd front && npm run dev      # site : http://localhost:5173
```

**Se connecter :** la connexion est réelle (comptes du seed, mot de passe `levelup123`). Choisis l'onglet du bon profil puis saisis `oscar.lescot` (étudiant), `m.dupuis` (enseignant) ou `admin.dsi` (administrateur). Le bouton « Se connecter avec le compte UPJV » connecte directement le compte de test du profil choisi.

**Voir le rendu mobile :** F12, puis Ctrl + Maj + M.

## 4. Structure du front

```
front/src/
├── main.tsx              Point d'entrée : BrowserRouter + AuthProvider
├── App.tsx               Table des routes
├── auth.tsx              Connexion factice (contexte React, rôle dans localStorage)
├── types.ts              Types partagés (futur contrat avec l'API)
├── index.css             Tailwind + charte (couleurs, police)
├── components/
│   ├── ui.tsx            Briques communes (Card, Tabs, ProgressBar, Toggle…)
│   ├── Header.tsx        En-tête et navigation (étudiant et enseignant)
│   ├── layout/           Logo, Footer, Layouts (StudentLayout, TeacherLayout)
│   └── …                 Blocs du tableau de bord (HeroCard, Ranking, Badges…)
├── pages/                Une page par route
│   ├── teacher/          Pages de l'espace enseignant
│   └── admin/            Pages de l'espace administrateur (comptes, promotions, contenus, référentiel)
└── data/                 Données factices
```

### 4.1 Routes

| Route | Page | Accès |
|---|---|---|
| `/connexion` | `Connexion.tsx` | Public |
| `/` | `Dashboard.tsx` | Étudiant |
| `/defis` | `Defis.tsx` | Étudiant |
| `/defis/:id` | `DefiDetail.tsx` | Étudiant |
| `/classement` | `Classement.tsx` | Étudiant |
| `/duels` | `Duels.tsx` | Étudiant |
| `/duels/en-direct` | `DuelLive.tsx` | Étudiant |
| `/profil` | `Profil.tsx` | Étudiant |
| `/succes` | `Succes.tsx` | Étudiant |
| `/enseignant` | `teacher/MesPromos.tsx` | Enseignant |
| `/enseignant/challenges` | `teacher/CreerDefi.tsx` | Enseignant |
| `/enseignant/competences` | `teacher/Competences.tsx` | Enseignant |
| `/enseignant/aide` | `teacher/Aide.tsx` | Enseignant |
| `/admin` | `admin/Comptes.tsx` | Administrateur |
| `/admin/promotions` | `admin/Promotions.tsx` | Administrateur |
| `/admin/contenus` | `admin/Contenus.tsx` | Administrateur |
| `/admin/referentiel` | `admin/Referentiel.tsx` | Administrateur |

Toute autre adresse redirige vers `/`.

### 4.2 Authentification et mises en page

- `auth.tsx` expose `AuthProvider` et le hook `useAuth()` (`role`, `login(identifiant, mot de passe)`, `logout`). `login` appelle l'API ; le jeton JWT renvoyé est conservé dans `localStorage` (`levelupjv-token`) avec le rôle (`levelupjv-role`). Si l'API répond 401 (jeton expiré), l'utilisateur est renvoyé à la connexion.
- `api.ts` : fonction `api()` (ajoute le jeton, gère les erreurs) et hook `useApi(chemin)` (chargement, erreur, rechargement). En développement, Vite redirige `/api` vers `http://localhost:3001`.
- `me.tsx` : `MeProvider` et `useMe()` donnent l'étudiant connecté (points, niveau, rang) à toutes les pages ; `refreshMe()` met à jour l'en-tête après un gain de points.
- `StudentLayout`, `TeacherLayout` et `AdminLayout` (`components/layout/Layouts.tsx`) entourent les pages : en-tête, contenu, pied de page.
  - Sans rôle : redirection vers `/connexion`.
  - Un utilisateur qui ouvre l'espace d'un autre rôle est renvoyé vers son accueil (`homeFor(role)` dans `auth.tsx`).
- `Header.tsx` : navigation avec lien actif, menu burger sur mobile, menu du compte (profil, déconnexion).

### 4.3 Composants communs (`components/ui.tsx`)

| Composant | Rôle |
|---|---|
| `Card`, `CardTitle` | Panneau gris arrondi et son titre |
| `ProgressBar` | Barre de progression accessible |
| `Avatar` | Pastille avec initiales |
| `Tabs`, `Segmented` | Onglets et boutons exclusifs |
| `Toggle` | Interrupteur (rôle `switch`) |
| `Breadcrumb`, `PageTitle` | Fil d'Ariane et titre de page |
| `DifficultyDots`, `CodeBlock`, `Delta` | Difficulté, code numéroté, évolution de rang |
| `buttonPrimary`, `buttonBrand`, `buttonOutline`, `inputClass` | Classes Tailwind partagées pour boutons et champs |

### 4.4 Charte graphique

Définie dans `index.css` (`@theme`) :

| Jeton | Couleur | Usage |
|---|---|---|
| `navy` | `#26314f` | Texte, boutons, bandeaux |
| `brand` | `#ef8a0e` | Accent orange, points |
| `brand-light` | `#fdf0dc` | Fonds d'accentuation |
| `page` / `panel` | `#f5f6f8` / `#ebeef3` | Fond de page / panneaux |
| `muted` | `#6b7385` | Texte secondaire |

Couleur par matière (`data/catalog.ts`, `subjectStyles`) : Bases de données en bleu, Algorithmique en orange, Développement web en marine, Réseaux et systèmes en rouge.

## 5. Les pages en détail

| Page | Fonctionnement (simulé) |
|---|---|
| **Connexion** | Onglets Étudiant / Enseignant, affichage du mot de passe, message d'erreur si champs vides. Redirige selon le rôle. |
| **Tableau de bord** | Bienvenue (niveau, XP, rang), « Mes défis » (onglets), activité sur 7 jours, badges, classement promo/groupe, objectifs du jour, bannière de duel. |
| **Défis** | Résumé par matière, recherche, filtres (niveau, statut), tri (recommandé, points, durée), favoris. |
| **Page d'un défi** | Éditeur SQL, « Exécuter » et « Valider » (résultat simulé), tables disponibles, résultat attendu et obtenu, 3 indices IA débloquables. Le contenu SQL est le même pour tous les défis. |
| **Classement** | Podium, tableau (recherche, promo/groupe), ligues, histogramme des points par semaine. |
| **Duels** | Choix de la matière, du niveau et du type de duel, invitations (accepter/refuser), camarades en ligne. |
| **Duel en direct** | Chrono décroissant, éditeur, « Lancer les tests » valide le test suivant, soumission, fil du duel et règles. |
| **Profil** | Quatre onglets (aperçu, badges, historique, compétences BUT), carte de chaleur, réglages de confidentialité. |
| **Succès** | 128 succès, 16 par page, bouton « Réclamer ». |
| **Mes promos** | Statistiques, notions où la promo bloque (filtre par matière), lancement d'un challenge en TD, étudiants à accompagner, compétences. |
| **Créer un défi** | Formulaire en 5 sections, aperçu étudiant en direct, liste de contrôle avant publication. |
| **Compétences / Aide** | Acquisition moyenne par compétence ; questions fréquentes. |
| **Espace administrateur** | Gestion des comptes, des promotions, des contenus et du référentiel de compétences (état partagé via `admin/store.tsx`). Ajouté par Tom. |

## 6. Données factices

| Fichier | Contenu |
|---|---|
| `data/mock.ts` | Utilisateur courant, défis du tableau de bord, classements, activité, badges, objectifs, série |
| `data/catalog.ts` | 24 défis du catalogue, styles par matière, détail du défi SQL |
| `data/community.ts` | Classement, ligues, duels, succès, profil, historique, carte de chaleur |
| `data/teacher.ts` | Statistiques de promo, notions, étudiants à accompagner, compétences |
| `data/admin.ts` | Données de l'espace administrateur (comptes, promotions, contenus, référentiel) |

Les types correspondants sont dans `types.ts`. Ils serviront de base au contrat avec l'API.

## 6 bis. Base de données (`back/`)

Mise en place par Erwan : PostgreSQL sous Docker, schéma et migrations Prisma, données de test. **Le front n'y est pas encore branché** : il n'existe pas encore d'API entre les deux.

```bash
cd back
npm install
cp .env.example .env                 # une seule fois
npm run db:up                        # démarre PostgreSQL (Docker Desktop doit tourner)
npm run db:migrate -- --name init    # crée les tables
npm run db:seed                      # données de test : <prénom>.<nom>@etu.example / levelup123
npm run db:studio                    # interface web pour voir les données
```

Autres scripts : `db:down` (arrête la base), `db:generate` (client Prisma), `db:reset` (remet la base à zéro).

**Fichiers :** `prisma/schema.prisma` (schéma), `prisma/migrations/` (à commiter après chaque modification), `prisma/seed.ts` (données de test), `src/db.ts` (connexion), `.env.example` (variables à copier).

**Modèles :**

| Domaine | Modèles |
|---|---|
| Utilisateurs | `User`, `Group` (rôles via l'énumération `Role`) |
| Défis | `Challenge`, `TestCase`, `Hint`, `Favorite`, `Attempt` |
| Compétences | `Competence`, `ChallengeCompetence` |
| Gamification | `PointEvent`, `Badge`, `UserBadge` |
| Duels | `Duel` (`DuelStatus`) |
| Arène live | `ArenaSession`, `ArenaChallenge`, `ArenaAnswer` |

Énumérations : `Role`, `Difficulty`, `ChallengeType`, `Subject`, `AttemptStatus`, `DuelStatus`, `ArenaStatus`. Les modèles `Arena*` préparent la piste « arène live en amphi ».

## 6 ter. API (`back/src/`)

Serveur Express (`server.ts`) qui lit et écrit dans PostgreSQL via Prisma. Toutes les routes sont sous `/api`. Sauf la connexion, elles demandent le jeton dans l'en-tête `Authorization: Bearer <jeton>` ; les routes étudiantes refusent les autres rôles.

| Méthode et route | Rôle |
|---|---|
| `POST /api/auth/login` | Connexion (`identifiant` : e-mail ou partie avant `@`, `password`). Renvoie le jeton et le rôle. |
| `GET /api/me` | Étudiant connecté : niveau, XP, points, ligue, rang, série |
| `GET /api/dashboard` | Tout le tableau de bord : défis, classements, activité 7 jours, badges, objectifs, série |
| `GET /api/ranking?scope=promo` ou `groupe` | Classement complet et points des 6 dernières semaines |
| `GET /api/challenges` | Catalogue avec l'état de l'étudiant (nouveau, en cours, terminé) et ses favoris |
| `GET /api/challenges/:id` | Détail : énoncé, tables du jeu de données, indices débloqués (la solution n'est jamais envoyée) |
| `POST /api/challenges/:id/run` | Exécute une requête sans la corriger |
| `POST /api/challenges/:id/attempt` | Correction automatique, tentative enregistrée, points et XP au **premier** succès |
| `POST /api/challenges/:id/hints` | Débloque un indice (le coût en points n'est prélevé qu'une fois) |
| `POST /api/challenges/:id/favorite` | Ajoute ou retire un favori |
| `GET /api/health` | Vérifie que l'API répond |

**Fichiers :** `routes.ts` (routes), `services.ts` (utilisateur, catalogue, classement), `sql.ts` (correction SQL), `auth.ts` (jetons, droits), `format.ts` (niveau, ligue, libellés).

**Correction SQL :** chaque exécution utilise une base SQLite jetable en mémoire (`node:sqlite`, intégré à Node 24), chargée avec le jeu de données du défi. Seule une requête `SELECT` ou `WITH` est acceptée. Le résultat de l'étudiant est comparé à celui de la requête de référence (valeurs et nombre de colonnes, ordre pris en compte si la référence contient `ORDER BY`). Les défis non SQL ne sont pas encore corrigeables.

**Règles de jeu :** niveau = XP ÷ 200 + 1 ; ligue selon les points (Bronze, Argent dès 2 000, Or dès 3 000…) ; rang = position par points dans la promo.

**Configuration :** variables dans `back/.env` (`DATABASE_URL`, `JWT_SECRET`, `PORT`), voir `.env.example`.

## 7. Conventions

- TypeScript en mode strict ; `npm run build` doit passer avant tout commit.
- Un composant par fichier, nommé en PascalCase ; une page par route dans `pages/`.
- Styles uniquement avec Tailwind ; couleurs via les jetons de la charte.
- Texte de l'interface en français.
- Accessibilité : libellés sur les champs, rôles ARIA sur onglets et interrupteurs, navigation clavier.
- Messages de commit en français.

## 8. Ajouter une page

1. Créer `src/pages/MaPage.tsx` (composant exporté par défaut).
2. Déclarer la route dans `App.tsx`, sous le layout du bon rôle (`StudentLayout`, `TeacherLayout` ou `AdminLayout`).
3. Ajouter un lien dans `studentNav` (`Header.tsx`) ou dans `teacherNav` (`Layouts.tsx`) si besoin.
4. Placer les données factices dans `src/data/` et les types dans `types.ts`.

## 9. Passer du factice au réel (ce qu'il reste à brancher)

Branchés sur l'API : connexion, tableau de bord, défis, page d'un défi, classement, en-tête du profil.

Encore factices : duels, succès, détails du profil (carte de chaleur, historique), espace enseignant, espace administrateur, ligues du classement.

Étapes suivantes :

1. Brancher les pages restantes sur de nouvelles routes (profil, succès, enseignant, administrateur).
2. Correction automatique des défis algorithmique et web (conteneurs isolés).
3. Socket.IO pour les duels.
4. Vrais indices IA (aujourd'hui des indices généraux écrits à l'avance).

## 10. Limites connues

- Les pages non branchées affichent des données factices, remises à zéro au rechargement.
- La correction automatique ne couvre que les défis SQL, et l'exécution SQL n'a pas de délai maximum : une requête volontairement très longue pourrait bloquer le serveur (à durcir avec un processus séparé).
- Le seed ne contient que 6 défis (le catalogue maquetté en prévoit 24) ; les indices sont les mêmes pour tous les défis.
- L'évolution du rang (flèches du classement) vaut 0 : elle n'est pas encore calculée.
- Pas de tests automatiques ni de CI.
- Rendu mobile à vérifier visuellement sur chaque page.
