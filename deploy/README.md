# Déploiement automatique (VPS)

Un `git push` sur la branche `main` met le site à jour tout seul, en moins d'une minute, **si les tests passent**.

## Fonctionnement

Une tâche cron lance `deploy/deploy.sh` toutes les minutes sur le VPS. Si `main` a avancé :

1. mise à jour du code (clone `/root/levelupjv-repo`, puis copie du `back/` dans `/root/levelupjv/back`) ;
2. `npm ci` si un `package-lock.json` a changé, puis `prisma generate` ;
3. **tests du back (`npm test`)** : un test qui échoue arrête tout ;
4. build du front (rien n'est publié à ce stade) ;
5. sauvegarde de la base (`/root/backups`, 10 dernières conservées), puis `prisma migrate deploy` ;
6. publication du front dans `/var/www/levelupjv` (nginx, port 8090), `pm2 restart levelupjv-api`, puis vérification de `/api/health`.

Les étapes 3 et 4 passent avant de toucher à la base et au site en ligne.

### Si ça échoue
- **Avant la migration** (tests, build…) : le code du back revient à la version précédente, la base et le site ne sont pas touchés.
- **L'API ne répond pas après le redémarrage** : retour du code à la version précédente et nouveau redémarrage. Les migrations de la base restent appliquées : écrivez-les pour qu'elles soient compatibles avec l'ancien code (ajouter des colonnes ou des tables, ne pas supprimer ni renommer).
- Le commit en échec n'est pas retenté en boucle. Corrigez et poussez un nouveau commit.

## Suivre un déploiement

```
ssh root@91.98.24.186 tail -f /root/levelupjv-deploy.log
```

- Commit en ligne : `cat /root/levelupjv/.commit`
- Dernier commit en échec : `cat /root/levelupjv/.commit_failed`

## Règles pour l'équipe

- **Travailler sur une branche** (`dev` ou une branche de fonctionnalité) et ne fusionner dans `main` que ce qui fonctionne : `main` part en production.
- Avant de fusionner : `npm test` et `npx tsc --noEmit` dans `back/`, `npm run build` dans `front/`.
- Les migrations Prisma sont appliquées automatiquement en production : elles doivent être sûres pour des données existantes.
- Le seed (`npm run db:seed`) n'est **jamais** lancé par le déploiement.
- Les cours (PDF) ne vont jamais dans le dépôt public : voir `back/scripts/ingest-course.ts`.

## Sauvegardes

- Avant chaque migration : `/root/backups/levelupjv_<date>_<commit>.dump` (10 dernières).
- Toutes les nuits à 3 h 10 : `deploy/backup.sh` écrit `/root/backups/levelupjv_nightly_<date>.dump` (14 dernières), journal dans `/root/levelupjv-backup.log`.
- Restauration : `sudo -u postgres pg_restore -d levelupjv --clean --if-exists <fichier>.dump`.
- Ces sauvegardes sont sur le même serveur : pour être à l'abri d'une panne du VPS, copiez-en une de temps en temps ailleurs (`scp root@91.98.24.186:/root/backups/<fichier> .`).

## nginx

Les fichiers de `deploy/nginx/` sont la copie de la configuration installée sur le VPS :

| Fichier du dépôt | Emplacement sur le VPS |
|---|---|
| `nginx/levelupjv-limits.conf` | `/etc/nginx/conf.d/levelupjv-limits.conf` |
| `nginx/levelupjv.conf` | `/etc/nginx/sites-available/levelupjv` |

Les limites de débit tiennent compte du fait qu'une classe entière se connecte avec **la même adresse IP** (30 connexions par minute en continu, rafale de 40 ; 100 requêtes par seconde pour l'API, rafale de 300). Pour appliquer une modification :

```
scp deploy/nginx/levelupjv-limits.conf root@91.98.24.186:/etc/nginx/conf.d/
scp deploy/nginx/levelupjv.conf root@91.98.24.186:/etc/nginx/sites-available/levelupjv
ssh root@91.98.24.186 'nginx -t && systemctl reload nginx'
```

## Installation (déjà faite, pour mémoire)

```
git clone https://github.com/erwan-cht/LevelUPJV.git /root/levelupjv-repo
( crontab -l
  echo '* * * * * bash /root/levelupjv-repo/deploy/deploy.sh'
  echo '10 3 * * * bash /root/levelupjv-repo/deploy/backup.sh' ) | crontab -
```
