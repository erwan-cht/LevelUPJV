# LevelUPJV : documentation technique

> État au 13/11/2026. Ce document décrit l'existant : le front, l'API et la base de données, entièrement reliés.
> Voir aussi : [`resume.md`](resume.md) (choix de stack, feuille de route) et [`cahier-des-charges.md`](cahier-des-charges.md) (besoins).

## 1. Vue d'ensemble

LevelUPJV est une plateforme de défis de programmation gamifiée pour les étudiants du BUT Informatique (IUT d'Amiens). Les défis sont corrigés automatiquement. Les étudiants gagnent des points, montent de niveau, se comparent au classement et s'affrontent en duel. Les enseignants suivent la promo et créent des défis.

```
LevelUPJV/
├── front/        Application React (existante)
├── back/         API Express et base de données Prisma (schéma, migrations, seed)
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
| Back | Node.js 24, Express 5, TypeScript | Fait |
| Base de données | PostgreSQL 16 et Prisma 7 (Docker Compose) | Fait (Erwan) |
| API | Express 5, jetons JWT (`jsonwebtoken`), mots de passe `bcryptjs` | Fait |
| Temps réel | Duels : relecture toutes les 2 s ; Socket.IO à venir | Provisoire |
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

**Après un `git pull` :** `cd back && npm install && npm run db:migrate` (nouvelles tables), puis `npm run db:seed` pour remettre les comptes de démonstration à jour ; `cd front && npm install`.

**Voir le rendu mobile :** F12, puis Ctrl + Maj + M.

## 4. Structure du front

```
front/src/
├── main.tsx              Point d'entrée : BrowserRouter + AuthProvider
├── App.tsx               Table des routes
├── auth.tsx              Connexion (contexte React, jeton JWT et rôle dans localStorage)
├── api.ts                Appels à l'API et hook useApi
├── me.tsx                Utilisateur connecté (points, niveau, rang)
├── format.ts             Libellés et dates
├── subjects.ts           Couleurs des matières et des ligues
├── types.ts              Types partagés (futur contrat avec l'API)
├── index.css             Tailwind + charte (couleurs, police)
├── components/
│   ├── ui.tsx            Briques communes (Card, Tabs, ProgressBar, Toggle…)
│   ├── Header.tsx        En-tête et navigation (étudiant et enseignant)
│   ├── layout/           Logo, Footer, Layouts (StudentLayout, TeacherLayout, AdminLayout)
│   └── …                 Blocs du tableau de bord (HeroCard, Ranking, Badges…)
└── pages/                Une page par route
    ├── teacher/          Pages de l'espace enseignant
    └── admin/            Pages de l'espace administrateur (comptes, promotions, contenus, référentiel)
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
| `/duels/:id` | `DuelLive.tsx` | Étudiant |
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
- `me.tsx` : `MeProvider` et `useMe()` donnent l'utilisateur connecté (points, niveau, rang pour un étudiant ; nom pour l'en-tête des autres rôles) à toutes les pages ; `refreshMe()` met à jour l'en-tête après un gain de points.
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

Couleur par matière (`subjects.ts`, `subjectStyles`) : Bases de données en bleu, Algorithmique en orange, Développement web en marine, Réseaux et systèmes en rouge.

## 5. Les pages en détail

| Page | Fonctionnement |
|---|---|
| **Connexion** | Onglets Étudiant / Enseignant, affichage du mot de passe, message d'erreur renvoyé par l'API (identifiants faux, compte suspendu ou en attente). Redirige selon le rôle. |
| **Tableau de bord** | Bienvenue (niveau, XP, rang et son évolution sur 7 jours), « Mes défis » (onglets), activité sur 7 jours, badges et prochain badge, classement promo/groupe, objectifs du jour, camarades en ligne. |
| **Défis** | Résumé par matière, recherche, filtres (niveau, statut), tri (recommandé, points, durée), favoris. « Recommandé » : défis proposés par un enseignant à ton groupe. |
| **Page d'un défi** | Éditeur SQL, « Exécuter » et « Valider » (correction automatique sur le jeu de données du défi), tables disponibles, résultat attendu et obtenu, 3 indices débloquables (leur coût est déduit du gain quand le défi est réussi). |
| **Classement** | Podium, tableau (recherche, promo/groupe), ligues (seuils fournis par l'API), évolution du rang, histogramme des points par semaine. |
| **Duels** | Choix de la matière, du niveau et du type de duel, invitations reçues (accepter/refuser), camarades de la promo avec leur présence. Les duels portent sur les défis SQL. |
| **Duel en direct** (`/duels/:id`) | Attente de l'adversaire, chrono de 10 minutes, éditeur SQL, « Exécuter » et « Soumettre », progression de l'adversaire, fil du duel, victoire, égalité ou abandon. La page relit l'état toutes les 2 secondes. |
| **Profil** | Quatre onglets (aperçu, badges, historique, compétences BUT), carte de chaleur des 12 dernières semaines, préférences de confidentialité enregistrées. |
| **Succès** | Tous les badges avec leur progression ; « Réclamer » crédite la récompense en points. |
| **Mes promos** | Statistiques de la promo (filtrables par promotion, groupe et période), notions où la promo bloque, assignation d'un challenge à un groupe (il devient « recommandé » chez les étudiants), étudiants à accompagner, compétences. |
| **Créer un défi** | Formulaire en 5 sections, aperçu étudiant en direct, liste de contrôle avant publication. L'enregistrement vérifie que la requête de référence s'exécute sur le jeu de données. |
| **Compétences / Aide** | Acquisition moyenne de la promo par compétence ; questions fréquentes. |
| **Espace administrateur** | Comptes (création avec mot de passe provisoire, suspension, suppression, réinitialisation), promotions et groupes, modération des contenus, référentiel de compétences, journal d'administration (`admin/store.tsx`). Ajouté par Tom. |

## 6. D'où viennent les données

Plus aucune donnée n'est écrite en dur dans le front : chaque page lit l'API (`api.ts`) et la base PostgreSQL. Il ne reste côté front que des réglages d'affichage :

| Fichier | Contenu |
|---|---|
| `subjects.ts` | Couleurs et abréviations des matières, couleurs des ligues |
| `format.ts` | Libellés des rôles et statuts, mise en forme des dates (« Hier, 17:55 ») |
| `types.ts` | Types partagés avec l'API |

Les chiffres affichés (points, rang, statistiques de promo…) sont calculés par l'API à partir de l'activité réelle : tentatives, gains de points, duels.

## 6 bis. Base de données (`back/`)

Mise en place par Erwan : PostgreSQL sous Docker, schéma et migrations Prisma, données de test.

```bash
cd back
npm install
cp .env.example .env     # une seule fois
npm run db:up            # démarre PostgreSQL (Docker Desktop doit tourner)
npm run db:migrate       # applique les migrations (crée ou met à jour les tables)
npm run db:seed          # données de démonstration
npm run db:studio        # interface web pour voir les données
```

Autres scripts : `db:down` (arrête la base), `db:generate` (client Prisma), `db:reset` (remet la base à zéro). Après un `git pull` qui contient une nouvelle migration : `npm install`, `npm run db:migrate`, puis `npm run db:seed` si besoin.

**Fichiers :** `prisma/schema.prisma` (schéma), `prisma/migrations/` (à commiter après chaque modification), `prisma/seed.ts` (données de démonstration), `src/db.ts` (connexion), `.env.example` (variables à copier).

**Modèles :**

| Domaine | Modèles |
|---|---|
| Utilisateurs | `User` (rôle, statut, préférences), `Group`, `Promotion` |
| Défis | `Challenge`, `TestCase`, `Hint`, `Favorite`, `Attempt`, `Assignment` (défi proposé par un enseignant à un groupe) |
| Compétences | `Competence`, `ChallengeCompetence` |
| Gamification | `PointEvent`, `Badge` (règle : mesure et seuil), `UserBadge` |
| Duels | `Duel`, `DuelEvent` (fil du duel) |
| Administration | `AuditLog` (journal d'administration) |
| Arène live | `ArenaSession`, `ArenaChallenge`, `ArenaAnswer` (pas encore utilisés) |

Énumérations : `Role`, `AccountStatus`, `ContentStatus`, `Difficulty`, `ChallengeType`, `Subject`, `AttemptStatus`, `DuelStatus`, `ArenaStatus`.

**Le seed remet les comptes de démonstration à zéro à chaque lancement** (mot de passe, statut, groupe, activité, badges, duels). Les comptes créés à la main et les défis créés par les enseignants ne sont pas touchés. Comptes : `oscar.lescot` (étudiant), `m.dupuis` (enseignant), `admin.dsi` (administrateur), mot de passe `levelup123` ou la valeur de `SEED_PASSWORD`. L'activité (tentatives, points, séries) est générée de façon déterministe : points, rang et statistiques de promo sont cohérents entre eux.

## 6 ter. API (`back/src/`)

Serveur Express (`server.ts`) qui lit et écrit dans PostgreSQL via Prisma. Toutes les routes sont sous `/api`. Sauf la connexion, elles demandent le jeton dans l'en-tête `Authorization: Bearer <jeton>`. Chaque route est limitée à un rôle (étudiant, enseignant ou administrateur).

**Accès.** Le compte est relu en base à chaque requête : un compte suspendu ou supprimé perd l'accès immédiatement, sans attendre l'expiration du jeton. Cette lecture note aussi la présence (« en ligne » = requête dans les 5 dernières minutes).

**Tous les rôles et espace étudiant** (`routes.ts`, `profile.ts`, `duels.ts`)

| Méthode et route | Rôle |
|---|---|
| `POST /api/auth/login` | Connexion (`identifiant` : e-mail ou partie avant `@`, `password`). Refuse les comptes suspendus ou en attente. |
| `GET /api/me` | Utilisateur connecté : niveau, XP, points, ligue, rang et évolution |
| `GET /api/dashboard` | Tableau de bord : défis, classements, activité 7 jours, badges, objectifs, série, camarades en ligne |
| `GET /api/ranking?scope=promo` ou `groupe` | Classement, ligues, points des 6 dernières semaines |
| `GET /api/challenges` · `GET /api/challenges/:id` | Catalogue (état, favoris, recommandations) · détail (la solution n'est jamais envoyée) |
| `POST /api/challenges/:id/run` · `attempt` · `hints` · `favorite` | Exécuter · corriger (points au **premier** succès) · débloquer un indice · favori |
| `GET /api/profile` | Statistiques, carte de chaleur, historique, progression par matière, compétences, préférences |
| `PATCH /api/me/settings` | Préférences (apparaître au classement, accepter les duels, rappel) |
| `GET /api/achievements` · `POST /api/achievements/:id/claim` | Succès et progression · réclamer la récompense (une seule fois) |
| `GET /api/duels` · `POST /api/duels` | Vue d'ensemble · lancer une invitation (adversaire choisi ou tiré au hasard) |
| `GET /api/duels/:id` | État du duel (chrono, progression, fil) ; tranche le duel si le chrono est écoulé |
| `POST /api/duels/:id/accept` · `decline` · `abandon` · `run` · `submit` | Répondre à l'invitation, abandonner, exécuter, soumettre une réponse |

**Enseignant** (`teacher.ts`, préfixe `/api/teacher`) : `GET /overview?promoId&groupId&period` (statistiques, notions, étudiants à accompagner, compétences), `GET /competences`, `GET /options`, `POST /assignments` (proposer un défi à un groupe ou une promo), `POST /challenges` (créer un défi : la requête de référence est testée avant l'enregistrement).

**Administrateur** (`admin.ts`, préfixe `/api/admin`) : `accounts` (liste, création, modification, `status`, `delete`, `reset-password`), `promotions` (création, groupes, référent, suppression), `contents` (publier, masquer, brouillon), `competences` (référentiel), `audit` (journal). Chaque modification est inscrite dans le journal. Un administrateur ne peut ni se suspendre ni se supprimer.

`GET /api/health` vérifie que l'API répond.

**Fichiers :** `routes.ts`, `profile.ts`, `duels.ts`, `teacher.ts`, `admin.ts` (routes) ; `services.ts` (classement, résumé de l'utilisateur, points) ; `badges.ts` (règles des badges) ; `sql.ts` (correction SQL) ; `auth.ts` (jetons, droits, présence) ; `format.ts` (niveau, ligue, libellés).

**Correction SQL :** chaque exécution utilise une base SQLite jetable en mémoire (`node:sqlite`, intégré à Node 24), chargée avec le jeu de données du défi. Seule une requête `SELECT` ou `WITH` est acceptée. Le résultat est comparé à celui de la requête de référence (valeurs et nombre de colonnes ; l'ordre compte si la référence contient `ORDER BY`, ou selon le choix de l'enseignant). Les défis non SQL ne sont pas encore corrigeables.

**Règles de jeu :**
- niveau = XP ÷ 200 + 1 ; ligue selon les points (Bronze, Argent dès 2 000, Or dès 3 000…) ; rang = position par points dans la promo, évolution = rang actuel contre rang d'il y a 7 jours.
- un défi rapporte ses points une seule fois, à la première réussite, moins le coût des indices utilisés (jamais en dessous de 0). Débloquer un indice ne retire aucun point sur le moment.
- un badge est gagné quand sa mesure atteint son seuil (défis réussis, série, duels gagnés, rang…) ; la récompense est créditée à la réclamation.
- un duel dure 10 minutes ; le premier à obtenir le résultat attendu gagne 60 points (duel classé). Au bout du chrono, celui qui a le plus avancé l'emporte ; à égalité, personne ne gagne.

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
4. Ajouter la route correspondante dans `back/src/`, lire les données avec `useApi('/chemin')` et placer les types partagés dans `types.ts`.

## 9. Ce qu'il reste à faire

Toutes les pages sont branchées sur l'API et la base. Étapes suivantes :

1. Correction automatique des défis algorithmique et web (conteneurs isolés) : les duels pourront alors couvrir toutes les matières.
2. Socket.IO pour les duels, à la place de la relecture toutes les 2 secondes.
3. Vrais indices IA (aujourd'hui des indices généraux écrits à l'avance).
4. Envoi d'e-mails : invitation, réinitialisation du mot de passe, rappel quotidien.
5. Arène live en amphi (les modèles `Arena*` existent, aucune page ne les utilise encore).
6. Tests automatiques et CI.

## 10. Limites connues

- La correction automatique ne couvre que les défis SQL, et l'exécution SQL n'a pas de délai maximum : une requête volontairement très longue pourrait bloquer le serveur (à durcir avec un processus séparé).
- Pas d'envoi d'e-mails : à la création d'un compte ou à la réinitialisation, l'administrateur reçoit un mot de passe provisoire à transmettre. Il n'y a pas encore de page pour changer son mot de passe. Le rappel quotidien est une préférence enregistrée, sans envoi.
- À la création d'un défi, seuls « L'ordre des lignes » et « Tentatives max » sont appliqués ; les réglages anti-triche et IA sont enregistrés mais pas encore utilisés. Les indices sont les mêmes pour tous les défis.
- Les compétences « Conduire un projet » et « Collaborer » restent à 0 % : aucun défi n'y est encore rattaché.
- Un enseignant voit toutes les promotions, pas seulement les siennes.
- L'avatar n'est pas modifiable.
- Pas de tests automatiques ni de CI.
- Rendu mobile à vérifier visuellement sur chaque page.
