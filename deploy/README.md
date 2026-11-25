# Déploiement automatique (VPS)

Un `git push` sur la branche `main` met le site à jour tout seul, en moins d'une minute.

## Fonctionnement

Une tâche cron lance `deploy/deploy.sh` toutes les minutes sur le VPS. Si `origin/main` a avancé :

1. mise à jour du code (clone `/root/levelupjv-repo`, puis copie du `back/` dans `/root/levelupjv/back`) ;
2. `npm ci` si un `package-lock.json` a changé ;
3. sauvegarde de la base (`/root/backups`, 10 dernières conservées), puis `prisma migrate deploy` ;
4. build du front et publication dans `/var/www/levelupjv` (nginx, port 8090) ;
5. `pm2 restart levelupjv-api`, puis vérification de `/api/health`.

Si une étape échoue, le commit est marqué en échec et n'est pas retenté ; il suffit de pousser un nouveau commit.

## Suivre un déploiement

```
ssh root@91.98.24.186 tail -f /root/levelupjv-deploy.log
```

- Commit en ligne : `cat /root/levelupjv/.commit`
- Dernier commit en échec : `cat /root/levelupjv/.commit_failed`

## Règles pour l'équipe

- Ne pousser sur `main` que du code qui compile (`npm run build` dans `front/`, `npx tsc --noEmit` dans `back/`).
- Les migrations Prisma sont appliquées automatiquement en production : elles doivent être sûres pour des données existantes.
- Le seed (`npm run db:seed`) n'est **jamais** lancé par le déploiement.

## Installation (déjà faite, pour mémoire)

```
git clone https://github.com/erwan-cht/LevelUPJV.git /root/levelupjv-repo
( crontab -l; echo '* * * * * bash /root/levelupjv-repo/deploy/deploy.sh' ) | crontab -
```
