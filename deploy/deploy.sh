#!/usr/bin/env bash
# Déploiement automatique de LevelUPJV, exécuté sur le VPS par cron (toutes les minutes).
# Si la branche main de GitHub a avancé : met à jour le code, lance les tests, construit le front, migre la base, redémarre l'API.
#
# Sécurités :
#   - les tests et le build du front passent AVANT de toucher à la base et au site en ligne ;
#   - si une étape échoue avant la migration, le code du back revient à la version précédente ;
#   - si l'API ne répond pas après le redémarrage, retour à la version précédente et nouveau redémarrage ;
#   - un commit en échec n'est pas retenté en boucle : il suffit de pousser un nouveau commit.
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
BRANCH=${DEPLOY_BRANCH:-main}    # branche suivie (main en production ; une autre uniquement pour tester ce script)

main() {
  exec 9>/var/lock/levelupjv-deploy.lock
  flock -n 9 || exit 0             # un déploiement à la fois

  cd "$REPO" || exit 1
  git fetch -q origin "$BRANCH" || exit 0
  NEW=$(git rev-parse "origin/$BRANCH")
  OLD=$(cat "$RUN/.commit" 2>/dev/null || true)
  [ "$NEW" = "$OLD" ] && exit 0                                       # déjà déployé
  [ "$NEW" = "$(cat "$RUN/.commit_failed" 2>/dev/null)" ] && exit 0   # déjà tenté et échoué : on attend un nouveau commit

  SYNCED=0     # le code du back a été remplacé
  MIGRATED=0   # la base a été migrée : plus de retour arrière automatique du code

  log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

  # Remet le code du back à l'état du commit précédemment déployé.
  rollback() {
    [ -n "$OLD" ] || return 0
    local tmp
    tmp=$(mktemp -d)
    if git -C "$REPO" archive "$OLD" back 2>/dev/null | tar -x -C "$tmp" \
      && rsync -a --delete --exclude node_modules --exclude .env --exclude generated "$tmp/back/" "$RUN/back/"; then
      (cd "$RUN/back" && npx prisma generate >> "$LOG" 2>&1)
      log "Retour du back à la version précédente ($OLD)."
    else
      log "ATTENTION : retour arrière impossible, vérifier $RUN/back à la main."
    fi
    rm -rf "$tmp"
  }

  fail() {
    log "ÉCHEC ($1) sur $NEW : déploiement abandonné."
    [ "$SYNCED" = 1 ] && [ "$MIGRATED" = 0 ] && rollback
    echo "$NEW" > "$RUN/.commit_failed"
    exit 1
  }
  run() { "$@" >> "$LOG" 2>&1 || fail "$*"; }

  log "Déploiement de $NEW (précédent : ${OLD:-aucun})"
  run git reset --hard "origin/$BRANCH"

  # ── Back : code, dépendances, client Prisma, tests ──
  run rsync -a --delete --exclude node_modules --exclude .env --exclude generated "$REPO/back/" "$RUN/back/"
  SYNCED=1
  cd "$RUN/back" || fail "cd back"
  LOCK_HASH=$(md5sum package-lock.json | cut -d' ' -f1)
  if [ ! -d node_modules ] || [ "$LOCK_HASH" != "$(cat "$RUN/.back_lock" 2>/dev/null)" ]; then
    run nice -n 10 npm ci --no-audit --no-fund
    echo "$LOCK_HASH" > "$RUN/.back_lock"
  fi
  run npx prisma generate
  run npm test                       # un test qui échoue empêche la mise en ligne

  # ── Front : installation et build (rien n'est publié tant que tout n'est pas prêt) ──
  cd "$REPO/front" || fail "cd front"
  LOCK_HASH=$(md5sum package-lock.json | cut -d' ' -f1)
  if [ ! -d node_modules ] || [ "$LOCK_HASH" != "$(cat "$RUN/.front_lock" 2>/dev/null)" ]; then
    run nice -n 10 npm ci --no-audit --no-fund
    echo "$LOCK_HASH" > "$RUN/.front_lock"
  fi
  run nice -n 10 npm run build

  # ── Sauvegarde de la base, puis migrations ──
  mkdir -p "$BACKUPS"
  if ! sudo -u postgres pg_dump levelupjv -Fc -f /tmp/levelupjv_pre_deploy.dump >> "$LOG" 2>&1; then fail "sauvegarde de la base"; fi
  mv /tmp/levelupjv_pre_deploy.dump "$BACKUPS/levelupjv_$(date +%Y%m%d_%H%M%S)_${NEW:0:7}.dump"
  ls -1t "$BACKUPS"/levelupjv_[0-9]*.dump | tail -n +11 | xargs -r rm -f   # garde les 10 dernières

  cd "$RUN/back" || fail "cd back"
  run npx prisma migrate deploy
  MIGRATED=1

  # ── Publication du front, redémarrage de l'API et vérification ──
  run rsync -a --delete "$REPO/front/dist/" "$WEB/"
  chmod -R a+rX "$WEB"
  pm2 restart "$PM2_NAME" >/dev/null 2>&1 || fail "pm2 restart"
  sleep 3
  if ! curl -fsS http://127.0.0.1:3001/api/health >> "$LOG" 2>&1; then
    log "L'API ne répond pas après le redémarrage : retour à la version précédente."
    rollback
    pm2 restart "$PM2_NAME" >/dev/null 2>&1
    fail "l'API ne répond pas après redémarrage"
  fi

  echo "$NEW" > "$RUN/.commit"
  rm -f "$RUN/.commit_failed"
  log "OK : $NEW en ligne."
}

main "$@"
exit $?
