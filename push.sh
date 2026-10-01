#!/usr/bin/env bash
# Kirim proyek ini ke https://github.com/ajiku-app/scan-wms.git
# Pakai:  bash push.sh
# Perlu login GitHub (SSH key, `gh auth login`, atau Personal Access Token saat diminta password).
set -euo pipefail
REPO="https://github.com/ajiku-app/scan-wms.git"
[ -d .git ] || git init -b main
git add -A
git commit -m "Capacitor: bungkus WMS Scan jadi aplikasi Android (APK/AAB) & iOS" || echo "(tidak ada perubahan baru)"
git remote get-url origin >/dev/null 2>&1 && git remote set-url origin "$REPO" || git remote add origin "$REPO"
git branch -M main
# repo di GitHub mungkin sudah berisi commit lain: gabungkan dulu agar tidak menimpa
git pull origin main --allow-unrelated-histories --no-rebase -X ours -m "Merge remote main" || true
git push -u origin main
echo "Selesai. Lihat build di: https://github.com/ajiku-app/scan-wms/actions"
