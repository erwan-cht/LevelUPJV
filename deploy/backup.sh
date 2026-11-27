#!/usr/bin/env bash
# Sauvegarde nocturne de la base LevelUPJV (cron, tous les jours à 3 h 10).
# Garde les 14 dernières sauvegardes dans /root/backups ; le déploiement en fait aussi une avant chaque migration.
# Restauration : sudo -u postgres pg_restore -d levelupjv --clean --if-exists <fichier>.dump
set -uo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH

BACKUPS=/root/backups
LOG=/root/levelupjv-backup.log
mkdir -p "$BACKUPS"
tmp=/tmp/levelupjv_nightly.dump
out="$BACKUPS/levelupjv_nightly_$(date +%Y%m%d).dump"

if sudo -u postgres pg_dump levelupjv -Fc -f "$tmp" 2>> "$LOG" && mv "$tmp" "$out"; then
  ls -1t "$BACKUPS"/levelupjv_nightly_*.dump | tail -n +15 | xargs -r rm -f
  echo "[$(date '+%F %T')] OK $(basename "$out") ($(du -h "$out" | cut -f1))" >> "$LOG"
else
  echo "[$(date '+%F %T')] ÉCHEC de la sauvegarde" >> "$LOG"
  rm -f "$tmp"
  exit 1
fi
