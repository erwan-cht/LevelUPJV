#!/usr/bin/env bash
# Déploiement automatique de LevelUPJV, exécuté sur le VPS par cron (toutes les minutes).
# Si origin/main a avancé : met à jour le code, migre la base, construit le front, redémarre l'API.
#
# Installation (une fois, sur le VPS) : voir deploy/README.md
set -uo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH   # cron démarre avec un PATH minimal

REPO=/root/levelupjv-repo        # clone git, réservé au déploiement (ne rien y modifier à la main)
RUN=/root/levelupjv              # API en production (pm2 : levelupjv-api) + marqueurs
WEB=/var/www/levelupjv           # fichiers servis par nginx (port 8090)
BACKUPS=/root/backups
LOG=/root/levelupjv-deploy.log
PM2_NAME=levelupjv-api

main() {
  exec 9>/var/lock/levelupjv-deploy.lock
  flock -n 9 || exit 0             # un déploiement à la fois

  cd "$REPO" || exit 1
  git fetch -q origin main || exit 0
  NEW=$(git rev-parse origin/main)
  [ "$NEW" = "$(cat "$RUN/.commit" 2>/dev/null)" ] && exit 0          # déjà déployé
  [ "$NEW" = "$(cat "$RUN/.commit_failed" 2>/dev/null)" ] && exit 0   # déjà tenté et échoué : on attend un nouveau commit

  log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }
  fail() { log "ÉCHEC ($1) sur $NEW : déploiement abandonné, l'ancienne version reste en ligne si possible."; echo "$NEW" > "$RUN/.commit_failed"; exit 1; }
  run() { "$@" >> "$LOG" 2>&1 || fail "$*"; }

  log "Déploiement de $NEW (précédent : $(cat "$RUN/.commit" 2>/dev/null || echo aucun))"
  run git reset --hard origin/main

  # ── Back : code, dépendances, client Prisma, migrations ──
  run rsync -a --delete --exclude node_modules --exclude .env --exclude generated "$REPO/back/" "$RUN/back/"
  cd "$RUN/back" || fail "cd back"
  LOCK_HASH=$(md5sum package-lock.json | cut -d' ' -f1)
  if [ ! -d node_modules ] || [ "$LOCK_HASH" != "$(cat "$RUN/.back_lock" 2>/dev/null)" ]; then
    run nice -n 10 npm ci --no-audit --no-fund
    echo "$LOCK_HASH" > "$RUN/.back_lock"
  fi
  run npx prisma generate

  mkdir -p "$BACKUPS"
  if ! sudo -u postgres pg_dump levelupjv -Fc -f /tmp/levelupjv_pre_deploy.dump >> "$LOG" 2>&1; then fail "sauvegarde de la base"; fi
  mv /tmp/levelupjv_pre_deploy.dump "$BACKUPS/levelupjv_$(date +%Y%m%d_%H%M%S)_${NEW:0:7}.dump"
  ls -1t "$BACKUPS"/levelupjv_*.dump | tail -n +11 | xargs -r rm -f   # garde les 10 dernières

  run npx prisma migrate deploy

  # ── Front : build puis publication ──
  cd "$REPO/front" || fail "cd front"
  LOCK_HASH=$(md5sum package-lock.json | cut -d' ' -f1)
  if [ ! -d node_modules ] || [ "$LOCK_HASH" != "$(cat "$RUN/.front_lock" 2>/dev/null)" ]; then
    run nice -n 10 npm ci --no-audit --no-fund
    echo "$LOCK_HASH" > "$RUN/.front_lock"
  fi
  run nice -n 10 npm run build
  run rsync -a --delete dist/ "$WEB/"
  chmod -R a+rX "$WEB"

  # ── Redémarrage de l'API et vérification ──
  pm2 restart "$PM2_NAME" >/dev/null 2>&1 || fail "pm2 restart"
  sleep 3
  curl -fsS http://127.0.0.1:3001/api/health >> "$LOG" 2>&1 || fail "l'API ne répond pas après redémarrage"

  echo "$NEW" > "$RUN/.commit"
  rm -f "$RUN/.commit_failed"
  log "OK : $NEW en ligne."
}

main "$@"
exit $?
