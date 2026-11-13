# Cahier des charges — Plateforme d'apprentissage gamifiée (LevelUP JV)

**Projet :** SAE BUT 3 Informatique — IUT d'Amiens
**Équipe :** Tom Podsadni, Erwan Christ, Oscar Lescot
**Commanditaire / référent :** M. Loge
**Version :** 1.0 — 13/11/2026 (brouillon à valider par l'équipe)

> Les points marqués **[À CONFIRMER]** sont des hypothèses de ma part, à valider (stack, planning, durée, etc.).

---

## 1. Contexte et problématique

Les étudiants de BUT Informatique s'exercent surtout sur des TD papier ou des exercices corrigés a posteriori. Le retour est lent, peu motivant et peu relié aux compétences du référentiel BUT. Il est aussi difficile pour un enseignant de savoir ce que sa classe a réellement compris.

## 2. Objectif du projet

Développer une **plateforme web d'apprentissage gamifiée** où les étudiants résolvent des défis (SQL, algorithmique, web…) **corrigés automatiquement**, gagnent des points, se comparent entre eux et reçoivent des **indices par IA**. Chaque défi est **rattaché aux compétences du référentiel BUT** pour alimenter le portfolio.

**Objectifs secondaires**
- Rendre l'entraînement plus engageant (points, niveaux, classements, duels).
- Donner un retour immédiat et pédagogique, au-delà de « juste / faux ».
- Fournir aux enseignants des outils d'animation (sessions live) et d'analyse.
- Produire une démo marquante pour la soutenance.

## 3. Périmètre

### 3.1 Dans le périmètre (socle obligatoire)
Authentification, catalogue de défis, correction automatique, points et classements, indices par IA, lien aux compétences BUT et portfolio, duels en temps réel, espace enseignant de base.

### 3.2 Pistes « effet wow » (facultatives, par priorité)
Voir §6. Elles ne sont pas toutes à réaliser.

### 3.3 Hors périmètre **[À CONFIRMER]**
- Application mobile native (le web responsive suffit).
- Intégration à l'ENT / Moodle / Scodoc.
- Paiement, système de notation officielle (la plateforme ne remplace pas l'évaluation).

## 4. Utilisateurs cibles

| Profil | Besoins principaux |
|---|---|
| **Étudiant BUT** | S'entraîner, progresser, se situer, comprendre ses erreurs, alimenter son portfolio |
| **Enseignant** | Créer/choisir des défis, animer une session live, voir ce que la classe a compris |
| **Administrateur** | Gérer comptes, contenus et référentiel de compétences |

## 5. Exigences fonctionnelles — socle

Priorité : **M** = Must, **S** = Should, **C** = Could.

### 5.1 Comptes et accès
| ID | Exigence | Prio |
|---|---|---|
| F-01 | Inscription / connexion (e-mail + mot de passe, ou SSO universitaire **[À CONFIRMER]**) | M |
| F-02 | Rôles : étudiant, enseignant, administrateur | M |
| F-03 | Profil étudiant : pseudo, avatar, niveau, points, historique | M |
| F-04 | Rattachement à un groupe / une promotion | S |

### 5.2 Défis
| ID | Exigence | Prio |
|---|---|---|
| F-10 | Catalogue de défis filtrable (thème, difficulté, compétence) | M |
| F-11 | Types de défis : **SQL** (priorité), algorithmique, web | M |
| F-12 | Éditeur de code intégré (coloration syntaxique) | M |
| F-13 | Chaque défi a un énoncé, un jeu de données/tests, une solution de référence, une difficulté, des compétences associées | M |
| F-14 | Création/édition de défis par les enseignants | M |
| F-15 | Défis algo/web : exécution sécurisée en bac à sable | S |

### 5.3 Correction automatique
| ID | Exigence | Prio |
|---|---|---|
| F-20 | SQL : exécution de la requête de l'étudiant sur une base isolée et comparaison du résultat avec celui attendu | M |
| F-21 | Retour immédiat : réussite, échec, écart constaté (lignes/colonnes manquantes ou en trop) | M |
| F-22 | Protection : timeout, limite de ressources, requêtes destructrices interdites (lecture seule) | M |
| F-23 | Algo/web : correction par jeux de tests automatiques | S |

### 5.4 Gamification
| ID | Exigence | Prio |
|---|---|---|
| F-30 | Points par défi (selon difficulté, nombre d'essais, usage d'indices) | M |
| F-31 | Niveaux / XP et badges | S |
| F-32 | Classements (global, par groupe, par période) | M |
| F-33 | **Duels en temps réel** entre deux étudiants (mêmes défis, vainqueur au plus rapide/correct) | M |
| F-34 | Série quotidienne (streak) et objectifs | C |

### 5.5 Indices par IA
| ID | Exigence | Prio |
|---|---|---|
| F-40 | Indice progressif demandé par l'étudiant, qui **ne donne pas la solution** | M |
| F-41 | L'IA reçoit l'énoncé, la requête de l'étudiant et l'écart de résultat | M |
| F-42 | Coût en points ou limite d'indices par défi | S |
| F-43 | Garde-fous : pas de fuite de la solution de référence, journalisation des échanges | M |

### 5.6 Compétences et portfolio
| ID | Exigence | Prio |
|---|---|---|
| F-50 | Référentiel de compétences BUT modélisé (compétences, niveaux, apprentissages critiques) | M |
| F-51 | Chaque défi rattaché à une ou plusieurs compétences | M |
| F-52 | Tableau de bord de progression par compétence | M |
| F-53 | Export du portfolio (PDF ou page partageable) | S |

### 5.7 Espace enseignant
| ID | Exigence | Prio |
|---|---|---|
| F-60 | Gestion des groupes et suivi de la progression des étudiants | S |
| F-61 | Gestion de sa bibliothèque de défis | M |
| F-62 | Statistiques de base par défi (taux de réussite, essais moyens) | S |

## 6. Pistes « effet wow » (par ordre de priorité conseillé)

| ID | Fonctionnalité | Description | Effort | Impact |
|---|---|---|---|---|
| W-01 | **Visualisation de l'exécution SQL** (signature) | Animation étape par étape : tables du FROM, lignes combinées au JOIN, lignes éliminées par le WHERE, groupes du GROUP BY, résultat final. Si la réponse est fausse, l'animation montre l'étape où le résultat diverge. Nécessite de parser et de réexécuter la requête soi-même. Extension possible à l'algo (variables et tableaux animés). | Très élevé | Très élevé |
| W-02 | **Arène live en amphi** | L'enseignant lance une session, les étudiants rejoignent par QR code (mobile/PC), tous résolvent les mêmes défis en même temps, classement en direct sur le vidéoprojecteur. | Élevé | Très élevé |
| W-03 | **Analyse de la salle en direct** | Après l'arène : « 68 % se sont trompés à l'étape du JOIN », erreurs les plus fréquentes, question la plus bloquante. Les données sont déjà collectées par l'arène. | Faible | Élevé |
| W-04 | **Arbre de compétences façon RPG** | Nœuds calqués sur le référentiel BUT, déblocage progressif, vue d'ensemble de la maîtrise. C'est la première chose que voit le jury. | Moyen | Élevé |
| W-05 | **Tuteur IA branché sur la visualisation** | L'IA pointe l'étape fautive (« Ton WHERE élimine les clients sans commande, regarde l'étape 3 ») et l'animation saute à cette étape. | Moyen | Élevé |
| W-06 | **Génération de défis pour les profs** | L'enseignant importe un schéma de BDD, la plateforme propose des défis dont les solutions sont vérifiées en les exécutant. | Moyen | Élevé (jury enseignant) |
| W-07 | **Game feel** | Animations de montée de niveau, effets sonores, transitions, classement animé lors d'un dépassement. 1 à 2 semaines en fin de projet. | Moyen | Moyen/Élevé |

**Stratégie recommandée :** W-01 comme signature, W-02 comme moment de démo, puis W-03 (meilleur rapport effort/effet), W-04, W-05, W-07. W-06 si le temps le permet. Faire un prototype rapide de W-01 dans les premières semaines et le montrer à un enseignant.

## 7. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| **Performance** | Correction SQL < 2 s ; classement live mis à jour < 1 s ; arène supportant au moins une classe entière (~30 participants simultanés, objectif 60) |
| **Sécurité** | Mots de passe hachés ; isolation des exécutions de code (conteneur/bac à sable) ; requêtes SQL en lecture seule avec timeout ; protection XSS/CSRF/injection ; secrets hors du dépôt |
| **Confidentialité / RGPD** | Collecte minimale ; consentement ; droit de suppression ; pas d'envoi de données personnelles à l'IA |
| **Disponibilité** | Fonctionnement stable pendant les démos et sessions live ; mode dégradé si l'IA est indisponible |
| **Compatibilité** | Navigateurs récents (Chrome, Firefox, Edge, Safari) ; responsive PC et mobile (rejoindre l'arène sur téléphone) |
| **Accessibilité** | Contrastes suffisants, navigation clavier, pas d'information portée par la seule couleur |
| **Ergonomie** | Maquettes Figma « LevelUPJV » comme référence graphique |
| **Maintenabilité** | Code versionné (Git), documenté, tests automatisés sur la correction et le scoring |
| **Évolutivité** | Ajout de nouveaux types de défis sans refonte ; plateforme utilisable sans l'équipe après le projet |

## 8. Architecture technique (stack retenue, cf. `docs/resume.md`)

| Couche | Techno | Rôle |
|---|---|---|
| Front | React + Vite + TypeScript | Interface (tableau de bord, défis, classement…) |
| Style | Tailwind CSS | Mise en forme fidèle à la maquette Figma |
| Back | Node.js + Express (ou Fastify) + TypeScript | API REST |
| Base de données | PostgreSQL + Prisma | Comptes, défis, points, badges (migrations versionnées) |
| Temps réel | Socket.IO | Duels (puis arène live) |
| Environnement | Docker Compose | PostgreSQL identique pour toute l'équipe |
| CI | GitHub Actions | Vérification automatique du code |

**Choix volontairement écartés pour l'instant :** NestJS (trop de notions), Redis (classement via `ORDER BY points`), Judge0 auto-hébergé (défis SQL dans une base SQLite jetable d'abord), CAS UPJV (connexion e-mail + mot de passe, CAS en bonus), monorepo (deux dossiers `front/` et `back/`).

**Exécution de code :** défis SQL sur base jetable en lecture seule ; algo/web en conteneurs Docker isolés (bonus). **IA :** API d'un LLM avec prompt strict **[À CONFIRMER]**.

**Organisation du dépôt :** `front/` (React), `back/` (à venir), `docs/` (résumé, cahier des charges), `maquettes/` (maquettes HTML d'origine).

## 9. Modèle de données (aperçu)

`Utilisateur` · `Groupe` · `Competence` · `Defi` (énoncé, type, difficulté, solution, jeu de données) · `DefiCompetence` · `Tentative` (réponse, résultat, durée, indices utilisés) · `Score` · `Badge` · `Duel` · `SessionArene` · `ReponseArene` · `Indice` (journal IA)

## 10. Organisation et planning **[À CONFIRMER]**

Répartition indicative (à ajuster selon les compétences de chacun) :

| Rôle | Responsabilités |
|---|---|
| Tom | Chef de projet, back-end/API, scoring |
| Erwan | À définir (ex. correction SQL, visualisation) |
| Oscar | À définir (ex. front, Figma, temps réel) |

Phases proposées :
1. **Cadrage et maquettes** (Figma, modèle de données, choix techniques)
2. **Socle** : comptes, défis SQL, correction automatique, points, classement
3. **Prototype de visualisation SQL (W-01)** — à montrer tôt à un enseignant
4. **Temps réel** : duels puis arène live (W-02) et analyse de salle (W-03)
5. **IA et compétences** : indices, arbre de compétences, portfolio
6. **Test réel** avec une autre classe (20 min en fin de TD BDD) et ajustements
7. **Game feel, recette, documentation, soutenance** (1 à 2 semaines réservées en fin)

## 11. Livrables

- Plateforme fonctionnelle déployée
- Code source versionné et documenté
- Cahier des charges, dossier de conception (UML, modèle de données), maquettes Figma
- Manuel utilisateur (étudiant et enseignant) et guide d'installation
- Rapport de tests et retours de test réels (chiffres)
- Support et démo de soutenance

## 12. Scénario de démo cible

1. Présentation de l'**arbre de compétences**.
2. Défi SQL **raté**, puis **corrigé grâce à la visualisation et au tuteur IA**.
3. **QR code** : le jury rejoint l'arène et joue.
4. **Analyse en direct** de leurs erreurs pour conclure.

## 13. Critères de réussite

- Un étudiant peut s'inscrire, résoudre un défi SQL et voir son score et sa compétence progresser.
- Une session live de 30 participants fonctionne sans interruption.
- La visualisation SQL couvre au moins SELECT / FROM / JOIN / WHERE / GROUP BY.
- Au moins un test réel avec une autre classe, avec des résultats chiffrés.
- Les indices IA aident sans révéler la solution.
- La démo de soutenance se déroule de bout en bout.

## 14. Risques

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Visualisation SQL trop complexe (parseur) | Élevée | Élevé | Prototype tôt ; limiter d'abord aux requêtes simples puis étendre |
| Sécurité de l'exécution de code | Moyenne | Élevé | SQL en lecture seule ; algo/web en conteneur ou différé |
| Charge en arène (temps réel) | Moyenne | Moyen | Tests de charge ; WebSocket léger |
| Dérive de périmètre (trop de wow) | Élevée | Élevé | Suivre l'ordre de priorité du §6 ; geler le périmètre avant la phase 7 |
| IA qui divulgue la solution ou indisponible | Moyenne | Moyen | Prompt strict, filtrage, mode dégradé |
| Manque de temps pour le polish | Moyenne | Moyen | Réserver 1 à 2 semaines en fin de projet |
