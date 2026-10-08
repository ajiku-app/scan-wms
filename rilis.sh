#!/usr/bin/env bash
# ============================================================
# Kirim perubahan Scan WMS ke GitHub (ajiku-app/scan-wms) + rilis opsional.
#
#   bash rilis.sh "pesan commit"           -> commit + push ke main (tanpa rilis baru)
#   bash rilis.sh 1.0.3 "pesan commit"    -> commit + tag v1.0.3 + push
#                                             => GitHub Actions membangun APK/AAB Android dan melampirkannya ke Release.
#
# Perlu login GitHub (gh auth login / SSH key / Personal Access Token).
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

VER=""; MSG=""
if [[ "${1:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then VER="$1"; shift; fi
MSG="${1:-}"
[ -z "$MSG" ] && MSG="${VER:+v$VER}${VER:+ - }Update Scan WMS"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || { echo "Anda di branch '$BRANCH'. Pindah dulu ke main: git checkout main"; exit 1; }

if [ -n "$VER" ]; then
  git rev-parse -q --verify "refs/tags/v$VER" >/dev/null && { echo "Tag v$VER sudah ada. Pakai nomor versi yang baru."; exit 1; }
  # samakan versi di package.json dengan nomor rilis
  node -e "const fs=require('fs');const p='package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.version='$VER';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n')"
  # samakan versi yang tampil di aplikasi (var APP_VER di www/app.js)
  node -e "const fs=require('fs');const p='www/app.js';const s=fs.readFileSync(p,'utf8');fs.writeFileSync(p,s.replace(/var APP_VER=\"[^\"]*\"/,'var APP_VER=\"$VER\"'))"
fi

git add -A
if git diff --cached --quiet; then echo "(tidak ada perubahan baru untuk di-commit)"; else git commit -m "$MSG"; fi

echo ">> Mengambil perubahan terbaru dari GitHub..."
git pull --rebase --autostash origin main

if [ -n "$VER" ]; then git tag -a "v$VER" -m "Scan WMS v$VER"; fi

echo ">> Mengirim ke GitHub..."
git push origin main
[ -n "$VER" ] && git push origin "v$VER"

echo "Selesai."
[ -n "$VER" ] && echo "Build APK: https://github.com/ajiku-app/scan-wms/actions  |  Rilis: https://github.com/ajiku-app/scan-wms/releases"
exit 0
