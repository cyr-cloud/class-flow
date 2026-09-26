#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_dir="${1:?Usage: bash backup.sh /absolute/backup/directory}"
case "$backup_dir" in /*) ;; *) echo 'Use an absolute backup directory' >&2; exit 1;; esac
cd -- "$(dirname -- "$0")"
mkdir -p -- "$backup_dir"
backup_file="$backup_dir/chat-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
docker compose exec -T db pg_dump -U classflow -d classflow -Fc > "$backup_file.partial"
test -s "$backup_file.partial"
docker compose exec -T db pg_restore --list < "$backup_file.partial" > /dev/null
mv -- "$backup_file.partial" "$backup_file"
printf 'Backup created: %s\n' "$backup_file"
